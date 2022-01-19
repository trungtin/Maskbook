import { ChainId, isSameAddress } from '@masknet/web3-shared-evm'
import { NetworkPluginID } from '@masknet/plugin-infra'
import addSeconds from 'date-fns/addSeconds'
import { KeyValue } from '@masknet/web3-providers'
import { NFT_AVATAR_DB_NAME, NFT_AVATAR_DB_NAME_STORAGE } from '../constants'
import { gun2 } from '../../../network/gun/version.2'
import { delay } from '@masknet/shared-base'

const NFTAvatarGUN = gun2.get(NFT_AVATAR_DB_NAME)
const READ_GUN_RETRIES = 10

const NFTAvatarDB = KeyValue.createJSON_Storage(NFT_AVATAR_DB_NAME)
const NFTAvatarDBStorage = KeyValue.createJSON_Storage(NFT_AVATAR_DB_NAME_STORAGE)

const cache = new Map<string, [Promise<string | undefined>, number]>()

async function getUserAddressFromGUN(userId: string): Promise<string | undefined> {
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < READ_GUN_RETRIES; i++) {
        const result = await NFTAvatarGUN
            // @ts-expect-error
            .get(userId).then!()
        if (result) return result
        await delay(500)
    }
    return
}

function getKey(networkPluginId = NetworkPluginID.PLUGIN_EVM, chainId: number = ChainId.Mainnet) {
    return `${networkPluginId}-${chainId}`
}

function getCacheKey(userId: string, networkPluginId = NetworkPluginID.PLUGIN_EVM, chainId: number = ChainId.Mainnet) {
    return `${userId}-${networkPluginId}-${chainId}`
}

async function _getUserAddress(userId: string, networkPluginId?: NetworkPluginID, chainId?: number) {
    try {
        const result = await NFTAvatarDB.get<{ networkPluginId: string; chainId: number; address: string }>(userId)
        if (!result || !result?.address) {
            const result = await NFTAvatarDBStorage.get<Record<string, string>>(userId)
            const address = result?.[getKey(networkPluginId, chainId)]
            if (address) return address
            return getUserAddressFromGUN(userId)
        }
        return result.address
    } catch {
        return
    }
}

export async function getUserAddress(userId: string, networkPluginId?: NetworkPluginID, chainId?: number) {
    let c = cache.get(getCacheKey(userId, networkPluginId, chainId))
    if (!c || Date.now() > c[1]) {
        try {
            cache.set(getCacheKey(userId, networkPluginId, chainId), [
                _getUserAddress(userId, networkPluginId, chainId),
                addSeconds(new Date(), 60).getTime(),
            ])
        } catch (err) {
            console.log(err)
        }
    }
    c = cache.get(getCacheKey(userId, networkPluginId, chainId))

    return c?.[0]
}

export async function setUserAddress(
    userId: string,
    address: string,
    networkPluginId?: NetworkPluginID,
    chainId?: number,
) {
    try {
        await NFTAvatarDBStorage.set<Record<string, string>>(userId, {
            [getKey(networkPluginId, chainId)]: address,
        })

        await NFTAvatarDB.set<{ networkPluginId: string; chainId: number; address: string }>(userId, {
            networkPluginId: networkPluginId ?? NetworkPluginID.PLUGIN_EVM,
            chainId: chainId ?? ChainId.Mainnet,
            address,
        })
    } catch {
        // do nothing
    } finally {
        const _address = await getUserAddress(userId, networkPluginId, chainId)
        if (!isSameAddress(_address, address))
            throw new Error('Something went wrong, and please check your connection.')
    }
}

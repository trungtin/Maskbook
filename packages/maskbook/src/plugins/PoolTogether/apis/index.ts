import { ChainId, formatBalance } from '@masknet/web3-shared'
import { API_URL } from '../constants'
import type { Pool, TokenFaucet } from '../types'

export async function fetchPools(chainId: ChainId) {
    // See https://github.com/pooltogether/pooltogether-api-monorepo for API documention
    const url = new URL(`/pools/${chainId}.json`, API_URL)
    const response = await fetch(url.toString(), {})
    return (await response.json()) as Pool[]
}

export async function fetchPool(address?: string, subgraphUrl?: string) {
    if (!address || !subgraphUrl) return undefined

    const body = {
        query: `{
            prizePool(id: "${address.toLowerCase()}") {
                underlyingCollateralToken
                underlyingCollateralDecimals
                underlyingCollateralName
                underlyingCollateralSymbol
                prizeStrategy{
                    singleRandomWinner{
                        prizePeriodSeconds,
                        prizePeriodStartedAt
                        ticket{
                            id
                            decimals
                            symbol
                            totalSupply
                        }
                    }
                    multipleWinners{
                        prizePeriodSeconds,
                        prizePeriodStartedAt
                        numberOfWinners
                        ticket{
                            id
                            decimals
                            symbol
                            totalSupply
                        }
                    }
                }
            }
        }`,
    }
    const response = await fetch(subgraphUrl, {
        body: JSON.stringify(body),
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
    })

    const result = (await response.json())?.data
    const prizePool = result.prizePool

    const prizeStrategy = prizePool.prizeStrategy.singleRandomWinne
        ? prizePool.prizeStrategy.singleRandomWinne
        : prizePool.prizeStrategy.multipleWinners

    return {
        address: address,
        config: {
            numberOfWinners: prizeStrategy.numberOfWinners ?? '1',
            prizePeriodSeconds: prizeStrategy.prizePeriodSeconds,
        },
        prize: {
            prizePeriodStartedAt: {
                hex: Number.parseInt(prizeStrategy.prizePeriodStartedAt, 10).toString(16),
            },
            prizePeriodSeconds: {
                hex: Number.parseInt(prizeStrategy.prizePeriodSeconds, 10).toString(16),
            },
        },
        prizePool: {
            address: address,
        },
        tokens: {
            ticket: {
                ...prizeStrategy.ticket,
                address: prizeStrategy.ticket.id,
                totalSupplyUnformatted: prizeStrategy.ticket.totalSupply,
                totalSupply: formatBalance(prizeStrategy.ticket.totalSupply, prizeStrategy.ticket.decimals),
            },
            underlyingToken: {
                address: prizePool.underlyingCollateralToken,
                symbol: prizePool.underlyingCollateralSymbol,
                name: prizePool.underlyingCollateralName,
                decimals: prizePool.underlyingCollateralDecimals,
            },
        },
        tokenFaucets: [] as TokenFaucet[],
    } as Pool
}

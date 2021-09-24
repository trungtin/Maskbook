import { SearchIcon } from '@masknet/icons'
import { InputBox, InputBoxProps } from '@masknet/theme'

export interface SearchInputProps extends InputBoxProps {}
export function SearchInput(props: SearchInputProps) {
    return <InputBox children={<SearchIcon />} {...props} />
}

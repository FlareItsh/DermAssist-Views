export const useSearch = () => {
  const searchQuery = useState('global_search_query', () => '')
  const placeholder = useState('global_search_placeholder', () => 'Search records, patients...')

  return {
    searchQuery,
    placeholder
  }
}

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SortableTable from '../SortableTable.vue'

const columns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'amount', label: 'Amount', sortable: true, numeric: true },
  { key: 'plain', label: 'Plain' },
]

const rows = [
  { id: '1', name: 'bravo', amount: '9.00', plain: 'x' },
  { id: '2', name: 'alpha', amount: '100.00', plain: 'y' },
  { id: '3', name: 'charlie', amount: '20.00', plain: 'z' },
]

function names(wrapper: ReturnType<typeof mount>): string[] {
  return wrapper.findAll('tbody tr').map((tr) => tr.findAll('td')[0].text())
}

describe('SortableTable', () => {
  it('renders rows in the given order before any sort', () => {
    const wrapper = mount(SortableTable, { props: { columns, rows, rowKey: 'id' } })

    expect(names(wrapper)).toEqual(['bravo', 'alpha', 'charlie'])
  })

  it('toggles between descending and ascending on header clicks', async () => {
    const wrapper = mount(SortableTable, { props: { columns, rows, rowKey: 'id' } })

    await wrapper.findAll('th')[0].trigger('click')
    expect(names(wrapper)).toEqual(['charlie', 'bravo', 'alpha'])

    await wrapper.findAll('th')[0].trigger('click')
    expect(names(wrapper)).toEqual(['alpha', 'bravo', 'charlie'])
  })

  it('sorts numeric columns numerically, not lexically', async () => {
    const wrapper = mount(SortableTable, { props: { columns, rows, rowKey: 'id' } })

    await wrapper.findAll('th')[1].trigger('click')

    // Lexical sort would put "9.00" above "100.00".
    expect(names(wrapper)).toEqual(['alpha', 'charlie', 'bravo'])
  })

  it('ignores clicks on non-sortable headers', async () => {
    const wrapper = mount(SortableTable, { props: { columns, rows, rowKey: 'id' } })

    await wrapper.findAll('th')[2].trigger('click')

    expect(names(wrapper)).toEqual(['bravo', 'alpha', 'charlie'])
  })

  it('shows the empty message when there are no rows', () => {
    const wrapper = mount(SortableTable, {
      props: { columns, rows: [], rowKey: 'id', empty: 'Nothing sold.' },
    })

    expect(wrapper.text()).toContain('Nothing sold.')
  })
})

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Table } from 'antd'

interface Row {
  key: number
  name: string
}

const data: Row[] = Array.from({ length: 30 }, (_, index) => ({
  key: index,
  name: `Row ${index + 1}`,
}))

function Harness() {
  return (
    <Table<Row>
      columns={[{ title: 'Name', dataIndex: 'name' }]}
      dataSource={data}
      pagination={{
        defaultPageSize: 10,
        showSizeChanger: true,
        pageSizeOptions: ['10', '20', '30'],
      }}
    />
  )
}

describe('Table pagination', () => {
  it('changes the visible row count when the page size changes', async () => {
    const u = userEvent.setup()
    render(<Harness />)

    expect(screen.getByText('Row 10')).toBeInTheDocument()
    expect(screen.queryByText('Row 11')).not.toBeInTheDocument()

    await u.click(screen.getByRole('combobox'))
    await u.click(await screen.findByTitle('30 / page'))

    expect(await screen.findByText('Row 30')).toBeInTheDocument()
    expect(screen.getByText('Row 11')).toBeInTheDocument()
  })
})

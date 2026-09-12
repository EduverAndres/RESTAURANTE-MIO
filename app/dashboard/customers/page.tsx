import type { Metadata } from 'next'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  aggregateCustomers,
  type CustomerOrder,
  type CustomerRow,
} from '@/lib/customers/aggregate'
import { requireActiveStoreRow } from '@/lib/dashboard/store-context'
import { formatCOP } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Clientes' }
export const dynamic = 'force-dynamic'

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

async function fetchCustomers(storeId: string): Promise<CustomerRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('orders')
    .select(
      'customer_id, status, total, created_at, customer:profiles!orders_customer_id_fkey(full_name)',
    )
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(5000)
  if (error) {
    console.error('Failed to load customers', error)
    return []
  }
  const orders: CustomerOrder[] = (data ?? []).map((order) => ({
    customer_id: order.customer_id,
    status: order.status,
    total: Number(order.total),
    created_at: order.created_at,
    customer: order.customer,
  }))
  return aggregateCustomers(orders)
}

export default async function CustomersPage() {
  const { store } = await requireActiveStoreRow('/dashboard/customers')
  const customers = await fetchCustomers(store.id)

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Clientes
        </h1>
        <p className="text-muted-foreground text-sm">
          Personas que han pedido en {store.name}, ordenadas por su último
          pedido.
        </p>
      </header>

      {customers.length === 0 ? (
        <EmptyState
          title="Todavía no tienes clientes"
          description="Cuando alguien haga su primer pedido aparecerá aquí con su historial."
        />
      ) : (
        <div className="rounded-card border-border bg-card shadow-soft overflow-x-auto border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Pedidos</TableHead>
                <TableHead className="text-right">Total gastado</TableHead>
                <TableHead className="text-right">Último pedido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {customer.orders}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCOP(customer.spent)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right">
                    <time dateTime={customer.lastOrderAt}>
                      {dateFormatter.format(new Date(customer.lastOrderAt))}
                    </time>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

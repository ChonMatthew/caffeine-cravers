import { notFound, redirect } from "next/navigation";

import { getActiveItemsWithOptions, getOrderById } from "@/lib/dal";
import { reconstructCartState } from "@/lib/order";

import { OrderTerminal, type MenuItem } from "../../order-terminal";

// Edit an UNPAID order before payment (requirement change #2). Same till as a
// new order, but seeded from the saved lines and saving back in place. A paid
// order has nothing to edit (the barista ticket is already out), so bounce to
// its detail. Next 16: `params` is a Promise.
export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) notFound();
  if (order.status === "paid") redirect(`/order/${id}`);

  const items = await getActiveItemsWithOptions();

  const menu: MenuItem[] = items.map((item) => ({
    id: item.id,
    name: item.name,
    priceCents: item.priceCents,
    category: item.category,
    groups: item.optionGroups.map((g) => ({
      id: g.id,
      name: g.name,
      required: g.required,
      options: g.options.map((o) => ({
        id: o.id,
        name: o.name,
        priceDeltaCents: o.priceDeltaCents,
      })),
    })),
  }));

  // Rebuild an editable cart from the saved lines (option ids recovered from the
  // live catalog by name). Prices re-quote from the current catalog on save.
  const initial = reconstructCartState(
    items,
    order.tableLabel,
    order.items.map((l) => ({
      itemId: l.itemId,
      itemName: l.itemName,
      quantity: l.quantity,
      note: l.note,
      unitPriceCents: l.unitPriceCents,
      options: l.optionsSnapshot,
    })),
  );

  return (
    <OrderTerminal
      menu={menu}
      editing={{ orderId: order.id, dailyNumber: order.dailyNumber, initial }}
    />
  );
}

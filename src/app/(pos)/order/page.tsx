import { getActiveItemsWithOptions } from "@/lib/dal";

import { OrderTerminal, type MenuItem } from "./order-terminal";

// The order/till screen (reqs #6-9). Server Component: reads active items with
// their (active) option groups/options, then hands a plain serialisable menu to
// the client terminal that owns the cart interaction.
export default async function OrderPage() {
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

  return <OrderTerminal menu={menu} />;
}

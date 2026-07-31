import { notFound, redirect } from "next/navigation";

import { getOrderById } from "@/lib/dal";

import { PaymentScreen } from "./payment-screen";

// Cash payment screen for an unpaid order (Phase 4.5). Next 16: `params` is a
// Promise. An already-paid order has nothing to pay, so bounce to its detail.
export default async function PayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) notFound();
  if (order.status === "paid") redirect(`/order/${id}`);

  return <PaymentScreen orderId={order.id} totalCents={order.totalCents} />;
}

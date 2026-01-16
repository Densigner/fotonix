import React, { useEffect, useRef } from "react";

type Props = {
  amount: string | number;
  productName: string;
  onSuccess?: (details: any) => void;
};

export default function PayPalButton({ amount, productName, onSuccess }: Props) {
  const ref = useRef(null);
  const rendered = useRef(false);

  useEffect(() => {
    const paypal = (window as any).paypal;
    const el = ref.current;
    if (!paypal || !el || rendered.current) return;

    // ensure visible container
    try {
      const w = el.getBoundingClientRect().width;
      if (w < 5) return;
    } catch (e) {
      // if measurement fails, proceed (defensive)
    }

    rendered.current = true;

    paypal
      .Buttons({
        style: { shape: "pill", color: "gold", label: "paypal" },
        createOrder: (_: any, actions: any) =>
          actions.order.create({
            intent: "CAPTURE",
            purchase_units: [{ amount: { value: String(amount) }, description: productName }],
          }),
        onApprove: async (_: any, actions: any) => {
          try {
            const details = await actions.order.capture();
            onSuccess?.(details);
          } catch (err) {
            console.error('PayPal capture failed', err);
          }
        },
        onError: (err: any) => console.error("PayPal error", err),
      })
      .render(el)
      .catch((err: any) => console.error('PayPal render failed', err));
  }, [amount, productName, onSuccess]);

  return React.createElement('div', { ref: ref, style: { minHeight: 45 } });
}

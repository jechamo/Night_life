-- Textos legales: Premium 1.1 (sigue inactiva hasta abrir pagos) y Patrocinio 1.2.
insert into public.legal_documents(slug, language, version, status, effective_at, title, summary, sections)
select 'premium', d.language, '1.1', 'inactive', now(), d.title, d.summary, case d.language
  when 'es' then jsonb_build_array(
    jsonb_build_object('heading', 'Qué compras', 'body', 'Ventajas de comodidad (Pase, Pase VIP, Pase de una noche) y extras sueltos (Chispas, Foco, Mensaje directo). Precios con IVA incluido antes de pagar.'),
    jsonb_build_object('heading', 'Renovación y cancelación', 'body', 'Las suscripciones se renuevan al final de cada periodo (mes, trimestre o año) hasta que las canceles desde Mi suscripción. Mantienes las ventajas hasta el final del periodo pagado.'),
    jsonb_build_object('heading', 'Inicio inmediato y desistimiento', 'body', 'Tienes 14 días desde la compra para desistir desde Mi suscripción. Al pagar nos pides empezar ya y aceptas perder el desistimiento en lo que uses: los créditos (Chispas, Focos y Mensajes directos) solo se reembolsan si no has usado ninguno de esa compra, y en las suscripciones y el Pase de una noche se devuelve la parte que aún no has disfrutado. En las apps, las compras las gestiona la tienda (Apple o Google) según sus condiciones.'),
    jsonb_build_object('heading', 'Pagos', 'body', 'Los procesa una pasarela segura (Stripe en la web; App Store o Google Play en las apps). Nunca vemos ni guardamos tu tarjeta. Facturas disponibles en Mi suscripción.'))
  else jsonb_build_array(
    jsonb_build_object('heading', 'What you buy', 'body', 'Comfort perks (Pass, VIP Pass, One-night pass) and extras (Sparks, Spotlight, Direct message). Prices include VAT and are shown before paying.'),
    jsonb_build_object('heading', 'Renewal and cancellation', 'body', 'Subscriptions renew at the end of each period (month, quarter or year) until you cancel them from My subscription. You keep the perks until the end of the paid period.'),
    jsonb_build_object('heading', 'Immediate start and withdrawal', 'body', 'You have 14 days from purchase to withdraw from My subscription. When paying you ask us to start right away and accept losing the right of withdrawal for what you use: credits (Sparks, Spotlights and Direct messages) are only refunded if you have not used any from that purchase, and for subscriptions and the One-night pass we refund the part you have not enjoyed yet. In the apps, purchases are handled by the store (Apple or Google) under its terms.'),
    jsonb_build_object('heading', 'Payments', 'body', 'Handled by a secure gateway (Stripe on the web; App Store or Google Play in the apps). We never see or store your card. Invoices are in My subscription.'))
  end
from public.legal_documents d
where d.slug = 'premium' and d.version = '1.0'
on conflict (slug, language, version) do nothing;

insert into public.legal_documents(slug, language, version, status, effective_at, title, summary, sections)
select 'sponsorship', d.language, '1.2', 'published', now(), d.title, d.summary,
  d.sections || jsonb_build_array(case d.language
    when 'es' then jsonb_build_object('heading', 'Cancelación y reembolsos', 'body', 'Es una contratación entre empresas: no se aplica el derecho de desistimiento de los consumidores. Si el patrocinio o Estadísticas Pro no pueden prestarse por causa nuestra, se reembolsa la parte no prestada. Para cualquier incidencia, escríbenos desde Contacto.')
    else jsonb_build_object('heading', 'Cancellation and refunds', 'body', 'This is a business-to-business contract: the consumer right of withdrawal does not apply. If the sponsorship or Pro stats cannot be provided for reasons on our side, the part not provided is refunded. For any issue, write to us from Contact.')
  end)
from public.legal_documents d
where d.slug = 'sponsorship' and d.version = '1.1'
on conflict (slug, language, version) do nothing;

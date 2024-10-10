// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'


type OrderRequest={
  order: OrderDto
  items: OrderItemDto[]
}

type OrderDto={
  user_id: string
  shipping_address: string
  recipient_name: string
}

type OrderItemDto={
  item_id: number
  quantity: number 
}


Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const request: OrderRequest = await req.json();

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert(request.order)
      .select('id')  

    if (orderError) {
      throw orderError
    }

    
    for (const item of request.items) {
      const { error: itemError } = await supabase
        .from('order_items')
        .insert({ order_id: orderData[0].id, item_id: item.item_id, quantity: item.quantity })

      if (itemError) {
        throw itemError
      }
    }

    const { data: orderTotals, error: orderTotalsError} = await supabase
    .from('order_details')
    .select('*');

    if (orderTotalsError){
      throw orderTotalsError
    }

    const orderTotalsResponse = [];

    for (const order of orderTotals){

      let sumItemValue = 0;

      const ot = order.order_items || []
      
      for ( const totalItem of ot){
        sumItemValue += totalItem.quantity * totalItem.item_price
      }

      orderTotalsResponse.push({order_id: order.order_id, total: sumItemValue})
    }

    return new Response(JSON.stringify({ data: orderTotalsResponse }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    return new Response(String(err?.message ?? err), { status: 500 })
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/order-handler' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSettings, logEvent } from '@/lib/storage';
import { photonFetch } from '@/lib/photon';

const BodySchema = z.object({
  action: z.enum(['buy', 'sell']),
  pool_id: z.number().int(),
  amount: z.number(),
  is_sol: z.boolean(),
  cur_balance: z.number().optional(),
  token_address: z.string().optional(),
  token_decimals: z.number().int().optional(),
});

export async function POST(req: Request) {
  const settings = await getSettings();
  const body = BodySchema.parse(await req.json());

  if (!settings.app.autoExecute) {
    return NextResponse.json({ success: false, error: 'autoExecute is disabled in settings' }, { status: 400 });
  }

  if (settings.app.mode === 'live' && !settings.app.enableLiveTrading) {
    return NextResponse.json({ success: false, error: 'enableLiveTrading is false (safety)' }, { status: 400 });
  }

  const purchase_dir = body.action;

  // In paper mode we do not hit Photon purchase endpoint.
  if (settings.app.mode === 'paper') {
    await logEvent('trade_execute_paper', {
      action: body.action,
      pool_id: body.pool_id,
      amount: body.amount,
      is_sol: body.is_sol,
      cur_balance: body.cur_balance ?? settings.photon.curBalanceSol,
    });
    return NextResponse.json({ success: true, mode: 'paper', simulated: true });
  }

  const payload: any = {
    amount: body.amount,
    purchase_dir,
    is_sol: body.is_sol,
    pool_id: body.pool_id,
    cur_balance: body.cur_balance ?? settings.photon.curBalanceSol,
    wallets: settings.photon.wallets,
    associated_accs: settings.photon.associatedAccs,
    advanced_settings: {
      slippage: body.action === 'buy' ? settings.execution.buySlippage : settings.execution.sellSlippage,
      use_private_node: settings.execution.usePrivateNode,
      priority: settings.execution.priority,
      bribery: settings.execution.bribery,
      strategy: settings.execution.strategy,
    },
  };

  const res = await photonFetch<any>(settings, '/api/purchases', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  await logEvent('trade_execute_live', { payload, response: res });
  return NextResponse.json(res);
}

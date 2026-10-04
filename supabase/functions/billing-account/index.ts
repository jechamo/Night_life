import { handleBillingAccount } from '../_shared/billing-account.ts'
Deno.serve((req) => handleBillingAccount(req))

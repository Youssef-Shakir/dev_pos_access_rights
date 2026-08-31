/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { PosOrderline } from "@point_of_sale/app/models/pos_order_line";

/**
 * Core calls `updateSavedQuantity()` on every table/order switch, and
 * its default implementation is just `this.saved_quantity = this.qty`
 * — i.e. it treats "the quantity as of this table switch" as the
 * "saved" (sent-to-kitchen) quantity, which has nothing to do with
 * what was actually sent.
 *
 * This is what caused: submit an item, leave the table, come back, add
 * more of it (unsent), leave and come back again — core's own
 * decrease-quantity branching (updateQuantityNumber/handleDecreaseLine
 * in order_summary.js) uses `saved_quantity` to tell "shrink down to
 * what was sent" (free) apart from "cut into what was sent" (needs
 * authorization). With `saved_quantity` wrongly bumped to the full
 * (sent + unsent) total on every switch, even reducing back down to
 * just the unsent top-up was treated as cutting into sent stock.
 *
 * Recompute it instead from the order's persisted
 * `last_order_preparation_change` snapshot — the real record of what
 * was sent for this line, keyed by its stable uuid — so it survives
 * any number of table switches correctly.
 */
patch(PosOrderline.prototype, {
    updateSavedQuantity() {
        const change = this.order_id?.last_order_preparation_change?.lines?.[this.preparationKey];
        this.saved_quantity = change ? change.quantity : 0;
    },
});

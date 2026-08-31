/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { ProductScreen } from "@point_of_sale/app/screens/product_screen/product_screen";
import { onMounted, onPatched } from "@odoo/owl";

// The desktop Pay button (ActionpadWidget) and the small-screen switch-pane
// Pay button carry these marker classes across Odoo point releases even
// though their surrounding wrapper markup / prop wiring has changed
// between versions. Hiding by selector here is a version-proof backstop
// on top of the QWeb template overrides in access_rights_product_screen.xml,
// which rely on prop names (`showActionButton`) that may not exist/be
// wired the same way on every point release.
const PAY_BUTTON_SELECTOR = ".pay-order-button, .pay-button";

patch(ProductScreen.prototype, {
    setup() {
        super.setup(...arguments);
        onMounted(() => this._enforcePaymentButtonAccess());
        onPatched(() => this._enforcePaymentButtonAccess());
    },

    _enforcePaymentButtonAccess() {
        const allowed = this.pos._hasAccess("pos_access_payment");
        for (const el of document.querySelectorAll(PAY_BUTTON_SELECTOR)) {
            el.style.display = allowed ? "" : "none";
        }
    },

    /**
     * Override numpad buttons to disable the discount button when the
     * cashier is not allowed to apply discounts.
     */
    getNumpadButtons() {
        const buttons = super.getNumpadButtons();
        if (
            this.pos.config.enable_access_rights &&
            this.pos.config.module_pos_hr
        ) {
            return buttons.map((btn) => {
                if (
                    btn.value === "discount" &&
                    !this.pos.cashierCanApplyDiscount()
                ) {
                    return { ...btn, disabled: true };
                }
                return btn;
            });
        }
        return buttons;
    },
});

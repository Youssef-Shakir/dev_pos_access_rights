/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { ProductScreen } from "@point_of_sale/app/screens/product_screen/product_screen";

patch(ProductScreen.prototype, {
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

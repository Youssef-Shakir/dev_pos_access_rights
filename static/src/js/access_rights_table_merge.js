/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { PosData } from "@point_of_sale/app/models/data_service";

/**
 * Disable the "drag a table onto another one" merge feature.
 *
 * The FloorScreen implements table merging purely by writing a truthy
 * `parent_id` on `restaurant.table` once a table is dropped on top of
 * another (see pos_restaurant's floor_screen.js `onDrop`). There is no
 * standalone method to override for this, so the write itself is
 * intercepted here and silently dropped. Un-linking an already-merged
 * table (`parent_id` set back to false/null when picking it up again)
 * is left untouched since that isn't "merging".
 */
patch(PosData.prototype, {
    write(model, ids, vals) {
        if (model === "restaurant.table" && vals && vals.parent_id) {
            return [];
        }
        return super.write(...arguments);
    },
});

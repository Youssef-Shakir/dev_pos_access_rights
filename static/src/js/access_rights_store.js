/** @odoo-module **/
/* global Sha1 */

import { patch } from "@web/core/utils/patch";
import { PosStore } from "@point_of_sale/app/store/pos_store";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { SelectionPopup } from "@point_of_sale/app/utils/input_popups/selection_popup";
import { NumberPopup } from "@point_of_sale/app/utils/input_popups/number_popup";
import { makeAwaitable } from "@point_of_sale/app/store/make_awaitable_dialog";
import { rpc } from "@web/core/network/rpc";
import { _t } from "@web/core/l10n/translation";

const CONNECTIVITY_CHECK_INTERVAL = 5000;
const OFFLINE_OVERLAY_ID = "pos-access-rights-offline-overlay";

patch(PosStore.prototype, {
  // ── Network connection enforcement (disable offline mode) ──────
  /**
   * After the store is fully loaded, start polling the server if this
   * POS config requires an always-on network connection.
   */
  async setup() {
    await super.setup(...arguments);
    this.isOffline = false;
    if (this.config.require_network_connection) {
      this._startConnectivityCheck();
    }
  },

  _startConnectivityCheck() {
    if (this._connectivityCheckInterval) {
      clearInterval(this._connectivityCheckInterval);
    }
    this._checkConnectivity();
    this._connectivityCheckInterval = setInterval(
      () => this._checkConnectivity(),
      CONNECTIVITY_CHECK_INTERVAL,
    );
  },

  async _checkConnectivity() {
    try {
      await rpc("/web/dataset/call_kw", {
        model: "res.lang",
        method: "get_installed",
        args: [],
        kwargs: {},
      });
      this._setOffline(false);
    } catch (error) {
      this._setOffline(true);
    }
  },

  _setOffline(offline) {
    if (this.isOffline === offline) {
      return;
    }
    this.isOffline = offline;
    if (offline) {
      this._showOfflineOverlay();
    } else {
      this._hideOfflineOverlay();
    }
  },

  _showOfflineOverlay() {
    if (document.getElementById(OFFLINE_OVERLAY_ID)) {
      return;
    }
    const overlay = document.createElement("div");
    overlay.id = OFFLINE_OVERLAY_ID;
    overlay.className = "pos-access-rights-offline-overlay";
    overlay.innerHTML =
      '<div class="pos-access-rights-offline-overlay-message">' +
      '<i class="fa fa-wifi fa-3x mb-3"/>' +
      `<div>${_t("No connection to server — please wait...")}</div>` +
      "</div>";
    document.body.appendChild(overlay);
  },

  _hideOfflineOverlay() {
    const overlay = document.getElementById(OFFLINE_OVERLAY_ID);
    if (overlay) {
      overlay.remove();
    }
  },

  // ── Helper: check if access-rights enforcement is active ──────
  _accessRightsActive() {
    return this.config.enable_access_rights && this.config.module_pos_hr;
  },

  /**
   * Generic check: read a boolean permission field from the
   * current cashier (hr.employee record).
   *
   * @param {string} field  e.g. "pos_access_discount"
   * @returns {boolean}
   */
  _hasAccess(field) {
    if (!this._accessRightsActive()) {
      return true;
    }
    const cashier = this.get_cashier();
    if (!cashier || cashier[field] === undefined) {
      return true;
    }
    return cashier[field] !== false;
  },

  /**
   * Show a standard "Access Denied" dialog.
   */
  _showAccessDenied(message) {
    this.dialog.add(AlertDialog, {
      title: _t("Access Denied"),
      body: message,
    });
  },

  // ── Price control ─────────────────────────────────────────────
  cashierHasPriceControlRights() {
    const base = super.cashierHasPriceControlRights();
    if (!base) {
      return false;
    }
    return this._hasAccess("pos_access_change_price");
  },

  // ── Discount helpers ──────────────────────────────────────────
  cashierCanApplyDiscount() {
    return this._hasAccess("pos_access_discount");
  },

  getCashierMaxDiscount() {
    if (!this._accessRightsActive()) {
      return 100;
    }
    const cashier = this.get_cashier();
    if (cashier && typeof cashier.pos_access_max_discount === "number") {
      return cashier.pos_access_max_discount;
    }
    return 100;
  },

  // ── Discount application override ─────────────────────────────
  async setDiscountFromUI(line, val) {
    if (!this.cashierCanApplyDiscount()) {
      this._showAccessDenied(_t("You are not allowed to apply discounts."));
      return;
    }
    const maxDiscount = this.getCashierMaxDiscount();
    const numVal = parseFloat(val);
    if (!isNaN(numVal) && numVal > maxDiscount) {
      this._showAccessDenied(
        _t("Maximum discount allowed is %s%.", maxDiscount),
      );
      return;
    }
    return super.setDiscountFromUI(line, val);
  },

  // ── Order deletion ────────────────────────────────────────────
  async _onBeforeDeleteOrder(order) {
    if (!this._hasAccess("pos_access_delete_order")) {
      this._showAccessDenied(_t("You are not allowed to delete orders."));
      return false;
    }
    return super._onBeforeDeleteOrder(order);
  },

  // ── Partner / Customer selection ──────────────────────────────
  async selectPartner() {
    if (!this._hasAccess("pos_access_customer")) {
      this._showAccessDenied(
        _t("You are not allowed to set or change the customer."),
      );
      return false;
    }
    return super.selectPartner(...arguments);
  },

  // ── Pricelist selection ───────────────────────────────────────
  async selectPricelist(pricelist) {
    if (!this._hasAccess("pos_access_pricelist")) {
      this._showAccessDenied(
        _t("You are not allowed to change the pricelist."),
      );
      return;
    }
    return super.selectPricelist(pricelist);
  },

  // ── Payment ──────────────────────────────────────────────────
  async pay() {
    if (!this._hasAccess("pos_access_payment")) {
      this._showAccessDenied(
        _t("You are not allowed to access the payment screen."),
      );
      return;
    }
    return super.pay();
  },

  // ── Product creation ──────────────────────────────────────────
  async allowProductCreation() {
    if (!this._hasAccess("pos_access_create_product")) {
      return false;
    }
    return super.allowProductCreation();
  },

  // ── Sent-quantity protection ────────────────────────────────────
  /**
   * Route quantity decreases through the confirmation-popup flow
   * (instead of instant numpad edition) once the selected line has
   * already been sent to the kitchen/preparation tool, so that
   * `handleDecreaseLine` gets a chance to enforce the permission.
   */
  disallowLineQuantityChange() {
    if (this._accessRightsActive()) {
      const order = this.get_order();
      const line = order && order.get_selected_orderline();
      if (line && line.saved_quantity > 0) {
        return true;
      }
    }
    return super.disallowLineQuantityChange();
  },

  /**
   * Ask the cashier to pick a colleague authorized to reduce a
   * quantity that was already sent, and verify their PIN.
   *
   * @returns {Promise<boolean>}
   */
  async _authorizeQuantityReduction() {
    if (!this._accessRightsActive()) {
      return true;
    }
    const eligible = this.models["hr.employee"].filter(
      (emp) => emp.pos_access_reduce_quantity !== false,
    );
    if (!eligible.length) {
      this._showAccessDenied(
        _t("No employee is authorized to reduce a quantity that has already been sent."),
      );
      return false;
    }
    const list = eligible.map((emp) => ({
      id: emp.id,
      item: emp,
      label: emp.name,
      isSelected: false,
    }));
    const employee = await makeAwaitable(this.dialog, SelectionPopup, {
      title: _t("Select an employee authorized to reduce this quantity"),
      list,
    });
    if (!employee) {
      return false;
    }
    if (employee._pin) {
      const inputPin = await makeAwaitable(this.dialog, NumberPopup, {
        formatDisplayedValue: (x) => x.replace(/./g, "•"),
        title: _t("Enter PIN"),
      });
      if (!inputPin || employee._pin !== Sha1.hash(inputPin)) {
        this._showAccessDenied(_t("Wrong PIN."));
        return false;
      }
    }
    return true;
  },
});

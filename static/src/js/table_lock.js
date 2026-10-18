/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { PosStore } from "@point_of_sale/app/store/pos_store";
import { FloorScreen } from "@pos_restaurant/app/floor_screen/floor_screen";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { rpc } from "@web/core/network/rpc";
import { _t } from "@web/core/l10n/translation";
import { onMounted, onWillUnmount, onPatched, useState } from "@odoo/owl";

// Acquiring a table lock on a weak connection: per-attempt time limit,
// number of attempts and pause between them.
const LOCK_TIMEOUT_MS = 8000;
const LOCK_ATTEMPTS = 2;
const LOCK_RETRY_DELAY_MS = 700;

function withTimeout(promise, ms) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Store lock refresh interval
let lockRefreshInterval = null;
let currentLockedTableId = null;

// Global lock status cache (shared between PosStore and FloorScreen)
let globalLockStatus = {};
let lockStatusCallbacks = [];

function notifyLockStatusChange() {
    for (const callback of lockStatusCallbacks) {
        callback(globalLockStatus);
    }
}

/**
 * Patch PosStore to handle table locking
 */
patch(PosStore.prototype, {
    /**
     * Check if current employee can override table locks
     */
    canOverrideTableLock() {
        const cashier = this.get_cashier();
        return cashier && cashier.pos_access_table_lock_override === true;
    },

    /**
     * Fetch lock status for all tables
     */
    async fetchTableLockStatus() {
        if (!this.config?.module_pos_restaurant) {
            return {};
        }

        const floors = this.models["restaurant.floor"]?.getAll() || [];
        const allTables = [];
        for (const floor of floors) {
            if (floor.table_ids) {
                allTables.push(...floor.table_ids.map((t) => t.id));
            }
        }

        if (allTables.length === 0) {
            return {};
        }

        try {
            const result = await rpc("/pos_access_rights/table/locks_status", {
                table_ids: allTables,
            });
            globalLockStatus = result;
            notifyLockStatusChange();
            return result;
        } catch (error) {
            console.error("[TableLock] Error fetching lock status:", error);
            return {};
        }
    },

    /**
     * Acquire a lock on a table before accessing it
     */
    async acquireTableLock(table) {
        if (!table || !this.config.module_pos_restaurant) {
            return { success: true };
        }

        const cashier = this.get_cashier();
        const employeeId = cashier ? cashier.id : null;
        const sessionId = this.session?.id || null;

        const params = { table_id: table.id, employee_id: employeeId, session_id: sessionId };
        // On a weak connection (tablets on Wi-Fi) a request can hang or be
        // dropped: give each attempt a time limit and retry once before
        // reporting a connection problem. Taking the same lock twice is
        // harmless (same user).
        for (let attempt = 1; attempt <= LOCK_ATTEMPTS; attempt++) {
            try {
                const result = await withTimeout(
                    rpc("/pos_access_rights/table/lock", params),
                    LOCK_TIMEOUT_MS
                );
                // Refresh the other tables' badges in the background: the
                // waiter should not wait for it to open the table.
                this.fetchTableLockStatus();
                return result;
            } catch (error) {
                console.warn(`[TableLock] Lock attempt ${attempt} failed:`, error);
                if (attempt < LOCK_ATTEMPTS) {
                    await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_DELAY_MS));
                }
            }
        }
        return { success: false, error: "network_error" };
    },

    /**
     * Release the lock on a table
     */
    async releaseTableLock(tableId) {
        if (!tableId) {
            return;
        }

        // Stop the refresh interval
        if (lockRefreshInterval) {
            clearInterval(lockRefreshInterval);
            lockRefreshInterval = null;
        }
        currentLockedTableId = null;

        try {
            await rpc("/pos_access_rights/table/unlock", {
                table_id: tableId,
            });
            // Refresh lock status after releasing
            await this.fetchTableLockStatus();
        } catch (error) {
            console.error("[TableLock] Error releasing lock:", error);
        }
    },

    /**
     * Start periodic lock refresh to keep the lock alive
     */
    startLockRefresh(tableId) {
        // Clear any existing interval
        if (lockRefreshInterval) {
            clearInterval(lockRefreshInterval);
        }

        currentLockedTableId = tableId;

        // Refresh every 30 seconds (half of the 60-second timeout)
        lockRefreshInterval = setInterval(async () => {
            if (currentLockedTableId) {
                try {
                    await rpc("/pos_access_rights/table/refresh_lock", {
                        table_id: currentLockedTableId,
                    });
                } catch (error) {
                    console.error("[TableLock] Error refreshing lock:", error);
                }
            }
        }, 30000);
    },

    /**
     * Override setTableFromUi to acquire lock first
     */
    async setTableFromUi(table, orderUuid) {
        // Ignore taps while a table is already opening (on a slow
        // connection waiters tap again because nothing seems to happen).
        if (this._tableOpening) {
            return;
        }
        this._tableOpening = true;
        // Standard POS loading overlay: shows that the table is opening and
        // blocks further taps until it is done.
        this.ui.block();
        let lockResult;
        try {
            lockResult = await this.acquireTableLock(table);
        } finally {
            this.ui.unblock();
            this._tableOpening = false;
        }

        if (!lockResult.success) {
            if (lockResult.error === "locked") {
                this.dialog.add(AlertDialog, {
                    title: _t("Table Locked"),
                    body: _t("This table is currently being used by %s.", lockResult.locked_by),
                });
            } else if (lockResult.error === "network_error") {
                this.dialog.add(AlertDialog, {
                    title: _t("Connection problem"),
                    body: _t(
                        "The tablet could not reach the server. Check the Wi-Fi connection and tap the table again."
                    ),
                });
            } else {
                this.dialog.add(AlertDialog, {
                    title: _t("Error"),
                    body: _t("Could not access the table. Please try again."),
                });
            }
            return;
        }

        // Start lock refresh
        this.startLockRefresh(table.id);

        // Call the original method
        return super.setTableFromUi(table, orderUuid);
    },

    /**
     * Override showScreen to release lock when leaving product screen
     */
    showScreen(screenName, props) {
        // If we're going to FloorScreen and we have a locked table, release it
        if (screenName === "FloorScreen" && currentLockedTableId) {
            this.releaseTableLock(currentLockedTableId);
        }
        return super.showScreen(screenName, props);
    },
});

/**
 * Patch FloorScreen to show locked tables and refresh lock status
 */
patch(FloorScreen.prototype, {
    setup() {
        super.setup(...arguments);

        // Reactive state for lock status
        this.lockState = useState({
            tableLocks: {},
            version: 0,  // Increment to trigger re-render
        });

        // Register callback for lock status changes
        const onLockChange = (newStatus) => {
            this.lockState.tableLocks = { ...newStatus };
            this.lockState.version++;
            // Update DOM after state change
            setTimeout(() => this.updateTableLockStyles(), 0);
        };
        lockStatusCallbacks.push(onLockChange);

        // Polling interval for lock status refresh
        let lockPollInterval = null;

        onMounted(async () => {
            // Initial fetch
            await this.pos.fetchTableLockStatus();
            this.updateTableLockStyles();

            // Poll every 5 seconds while on floor screen
            lockPollInterval = setInterval(async () => {
                await this.pos.fetchTableLockStatus();
            }, 5000);
        });

        // Update lock styles whenever component re-renders (e.g., after table sync)
        onPatched(() => {
            this.updateTableLockStyles();
        });

        onWillUnmount(() => {
            // Stop polling
            if (lockPollInterval) {
                clearInterval(lockPollInterval);
                lockPollInterval = null;
            }
            // Remove callback
            const index = lockStatusCallbacks.indexOf(onLockChange);
            if (index > -1) {
                lockStatusCallbacks.splice(index, 1);
            }
        });
    },

    /**
     * Override to refresh lock status when changing floors
     */
    async selectFloor(floor) {
        const result = super.selectFloor(floor);
        // Refresh locks when floor changes
        await this.pos.fetchTableLockStatus();
        return result;
    },

    /**
     * Update DOM elements with lock styling
     */
    updateTableLockStyles() {
        const currentUserId = this.pos.user?.id;
        const lockStatus = this.lockState.tableLocks;

        // Get all table elements
        const tableElements = document.querySelectorAll("[class*='tableId-']");

        for (const tableEl of tableElements) {
            // Extract table ID from class
            const match = tableEl.className.match(/tableId-(\d+)/);
            if (!match) continue;

            const tableId = parseInt(match[1]);
            const lockInfo = lockStatus[tableId];

            // Remove existing lock elements
            const existingBadge = tableEl.querySelector(".table-lock-badge");
            if (existingBadge) {
                existingBadge.remove();
            }

            if (lockInfo?.locked && lockInfo.lock_user_id !== currentUserId) {
                // Add locked class
                tableEl.classList.add("table-locked");

                // Add lock badge
                const badge = document.createElement("div");
                badge.className = "table-lock-badge";
                badge.innerHTML = `<i class="fa fa-lock me-1"></i>${lockInfo.locked_by}`;
                tableEl.appendChild(badge);
            } else {
                // Remove locked class
                tableEl.classList.remove("table-locked");
            }
        }
    },

    /**
     * Check if a table is locked by someone else
     */
    isTableLocked(table) {
        const status = this.lockState.tableLocks[table.id];
        if (!status || !status.locked) {
            return false;
        }
        const currentUserId = this.pos.user?.id;
        return status.lock_user_id !== currentUserId;
    },

    /**
     * Get the name of who locked the table
     */
    getTableLockedBy(table) {
        const status = this.lockState.tableLocks[table.id];
        return status?.locked_by || _t("Unknown");
    },
});

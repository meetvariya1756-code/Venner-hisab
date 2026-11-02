# Implementation Plan: Venner Hisab Feature Upgrades

This plan details the technical changes to implement high-impact business features: **Customer Credit Limits & Overdue Tracking**, **UPI Payment QR & Shareable WhatsApp Slip Generator**, **Receipt Smart Extractor / OCR Fallback**, and **1-Click Full System Backup**.

---

## User Review Required

> [!IMPORTANT]
> The database migration will automatically add `credit_limit` and `due_date` columns to the `bank_accounts` table without affecting any existing records.

---

## Proposed Changes

### 1. Database & Backend Models
#### [MODIFY] [account.py](file:///e:/Venner-hisab-main/Venner-hisab-main/backend/app/models/account.py)
- Add `credit_limit = Column(Float, default=0.0)`
- Add `due_date = Column(DateTime, nullable=True)`
- Add `upi_id = Column(String(100), nullable=True)` (for generating direct payment QR codes)

#### [MODIFY] [main.py](file:///e:/Venner-hisab-main/Venner-hisab-main/backend/app/main.py)
- Add database migration check to auto-add `credit_limit`, `due_date`, and `upi_id` to `bank_accounts` if not present.

---

### 2. Khatabook API & Services
#### [MODIFY] [khatabook.py](file:///e:/Venner-hisab-main/Venner-hisab-main/backend/app/api/khatabook.py)
- Update `/accounts` endpoint to return:
  - `credit_limit`: Customer credit limit
  - `credit_used_percent`: Real-time credit utilization percentage
  - `is_overdue`: Boolean flag if account has unpaid dues past due date
  - `days_overdue`: Days elapsed since due date
  - `aging_bucket`: `0-30 days`, `31-60 days`, or `60+ days`
- Add `/accounts/{account_id}/settings` endpoint to update customer credit limit, due date, and UPI ID.
- Add `/parse-bill-receipt` endpoint for OCR / smart field extraction from uploaded bill images.

#### [MODIFY] [export.py](file:///e:/Venner-hisab-main/Venner-hisab-main/backend/app/api/export.py)
- Add `/backup/download` endpoint to generate and download a complete full-state JSON backup of all accounts, transactions, khatabook ledgers, and rules.

---

### 3. Frontend UI & Khatabook Views
#### [MODIFY] [types/index.ts](file:///e:/Venner-hisab-main/Venner-hisab-main/frontend/src/types/index.ts)
- Add `credit_limit`, `due_date`, `upi_id`, `credit_used_percent`, `is_overdue`, `days_overdue`, `aging_bucket` to `KhatabookAccount` and `BankAccount` interfaces.

#### [MODIFY] [client.ts](file:///e:/Venner-hisab-main/Venner-hisab-main/frontend/src/api/client.ts)
- Add `updateKhatabookAccountSettings`, `parseBillReceipt`, and `downloadSystemBackup` API client helpers.

#### [MODIFY] [KhatabookView.tsx](file:///e:/Venner-hisab-main/Venner-hisab-main/frontend/src/components/khatabook/KhatabookView.tsx)
- **Credit Limit & Overdue Badges**:
  - Show warning badges (e.g., `⚠️ Overdue 14 Days`, `🔴 Limit Exceeded`) on account list cards.
  - Credit utilization progress bar in Account Detail pane.
- **UPI QR Code & WhatsApp Slip Generator**:
  - Add "Pay QR & Share" button in Account Detail header.
  - Interactive modal displaying a QR code for exact outstanding balance + 1-click formatted WhatsApp text slip copy button.
- **Account Settings Modal**:
  - Modal to set/edit credit limit (₹), due date, and UPI ID for any customer.
- **1-Click Backup Button**:
  - Quick backup download button in header toolbar.

---

## Verification Plan

### Automated / API Verification
- Test `/api/khatabook/accounts` with credit limits and aging buckets.
- Test `/api/export/backup/download` to ensure complete JSON snapshot is returned.

### Manual Verification
1. Open `http://localhost:3000` in browser.
2. Navigate to **Khatabook** tab.
3. Open an account, click **"Edit Limits & Due Date"**, set credit limit to ₹50,000, and set due date.
4. Verify credit progress bar and overdue indicator update dynamically.
5. Click **"Pay QR & Share"** to verify the UPI QR code and WhatsApp formatted slip generation.
6. Click **"Backup Data"** to download the full database snapshot.

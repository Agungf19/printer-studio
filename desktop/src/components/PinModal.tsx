import { useEffect, useState } from "react";
import { KeyRound, Eye, EyeOff, Trash2 } from "lucide-react";
import { api } from "../api/client";

export default function PinModal({ onClose }: { onClose: () => void }) {
  const [hasPin, setHasPin] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadPin() {
    setLoading(true);
    try {
      const res = await api.getPin();
      setHasPin(res.has_pin);
      setCurrentPin(res.pin);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setError("");
    if (newPin.length < 4) {
      setError("PIN harus minimal 4 karakter.");
      return;
    }
    if (newPin !== confirmPin) {
      setError("Konfirmasi PIN tidak cocok.");
      return;
    }
    try {
      await api.setPin(newPin);
      await loadPin();
      setNewPin("");
      setConfirmPin("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan PIN");
    }
  }

  async function handleClear() {
    try {
      await api.clearPin();
      await loadPin();
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void loadPin();
  }, []);

  return (
    <div className="ps-overlay open">
      <div
        className="ps-modal"
        role="dialog"
        aria-labelledby="pinTitle"
        style={{ width: 400 }}
      >
        <h2 id="pinTitle">
          <KeyRound
            size={18}
            style={{ marginRight: 8, verticalAlign: "middle" }}
          />
          Kode PIN
        </h2>
        <p className="sub">
          PIN digunakan untuk membatasi siapa yang bisa pairing ke komputer ini.
        </p>

        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "#7d7a75" }}>
            Memuat...
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Current PIN status */}
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                background: hasPin ? "#e8f5e9" : "var(--soft)",
                border: `1px solid ${hasPin ? "#c8e6c9" : "var(--border)"}`,
                fontSize: 12.5,
              }}
            >
              <strong>Status:</strong>{" "}
              {hasPin ? (
                <span style={{ color: "#46a171" }}>
                  PIN aktif ({showPin ? currentPin : "••••••"})
                  <button
                    onClick={() => setShowPin(!showPin)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      marginLeft: 6,
                      verticalAlign: "middle",
                      padding: 0,
                    }}
                  >
                    {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </span>
              ) : (
                <span style={{ color: "#7d7a75" }}>PIN belum diatur</span>
              )}
            </div>

            {/* Set new PIN */}
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "#7d7a75",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                {hasPin ? "Ubah PIN" : "Atur PIN Baru"}
              </label>
              <input
                type={showPin ? "text" : "password"}
                placeholder="Minimal 4 karakter"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                maxLength={16}
                style={{
                  width: "100%",
                  height: 34,
                  padding: "4px 10px",
                  border: "1px solid #e6e5e3",
                  borderRadius: 6,
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--text2)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Konfirmasi PIN
              </label>
              <input
                type={showPin ? "text" : "password"}
                placeholder="Ulangi PIN"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                maxLength={16}
                style={{
                  width: "100%",
                  height: 34,
                  padding: "4px 10px",
                  border: "1px solid #e6e5e3",
                  borderRadius: 6,
                  fontSize: 13,
                }}
                onKeyDown={(e) => e.key === "Enter" && void handleSave()}
              />
            </div>

            {error && (
              <div style={{ color: "#e56458", fontSize: 12, padding: "4px 0" }}>
                ⚠️ {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="ps-btn-small"
                style={{
                  background: "#2783de",
                  color: "#fff",
                  padding: "6px 16px",
                  height: 34,
                }}
                onClick={() => void handleSave()}
              >
                Simpan PIN
              </button>
              {hasPin && (
                <button
                  className="ps-btn-small"
                  style={{ color: "#e56458", padding: "6px 16px", height: 34 }}
                  onClick={() => void handleClear()}
                >
                  <Trash2 size={13} /> Hapus PIN
                </button>
              )}
            </div>
          </div>
        )}

        <div className="ps-modal-actions">
          <button className="danger" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

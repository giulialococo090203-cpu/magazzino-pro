import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../App';
import { normalizeRole } from '../../data/permissions';
import {
  DEFAULT_PRICE_SETTINGS,
  calcInstallerPrice,
  calcListPrice,
  getPriceSettings,
  normalizePriceSettings,
  savePriceSettings,
} from '../../utils/priceSettings';

function formatCurrency(value) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(value || 0));
}

function isDatore(user) {
  return ['datore', 'admin'].includes(normalizeRole(user?.role));
}

export default function ImpostazioniPrezzi() {
  const { user } = useAuth();

  const [settings, setSettings] = useState({ ...DEFAULT_PRICE_SETTINGS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [error, setError] = useState('');

  const canEdit = isDatore(user);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError('');

        const loaded = await getPriceSettings();

        if (mounted) {
          setSettings(normalizePriceSettings(loaded));
        }
      } catch (err) {
        console.error('Errore caricamento impostazioni prezzi:', err);

        if (mounted) {
          setError('Non riesco a caricare le impostazioni prezzi.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const previewNetPrice = 100;

  const preview = useMemo(() => {
    return {
      listPrice: calcListPrice(previewNetPrice, settings),
      installerPrice: calcInstallerPrice(previewNetPrice, settings),
    };
  }, [settings]);

  const updateField = (field, value) => {
    setSavedMessage('');
    setError('');

    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetDefaults = () => {
    setSavedMessage('');
    setError('');
    setSettings({ ...DEFAULT_PRICE_SETTINGS });
  };

  const handleSave = async () => {
    if (!canEdit) return;

    const normalized = normalizePriceSettings(settings);

    if (normalized.vatPercent < 0) {
      setError('L’IVA non può essere negativa.');
      return;
    }

    if (normalized.installerDiscountPercent < -100) {
      setError('Lo sconto installatore non può essere inferiore a -100%.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSavedMessage('');

      const saved = await savePriceSettings(normalized);

      setSettings(saved);
      setSavedMessage('Impostazioni prezzi salvate correttamente.');
    } catch (err) {
      console.error('Errore salvataggio impostazioni prezzi:', err);
      setError(err.message || 'Errore durante il salvataggio delle impostazioni prezzi.');
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) {
    return (
      <div className="animate-slideUp">
        <div className="page-header">
          <div>
            <h1 className="page-title">Impostazioni Prezzi</h1>
            <p className="page-subtitle">Configurazione formule prezzi</p>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="empty-state">
              <div className="empty-state-icon">🔒</div>
              <div className="empty-state-title">Accesso non consentito</div>
              <div className="empty-state-text">
                Solo il datore può modificare le formule dei prezzi.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="animate-slideUp" style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <div className="text-muted">Caricamento impostazioni prezzi...</div>
      </div>
    );
  }

  return (
    <div className="animate-slideUp">
      <div className="page-header">
        <div>
          <h1 className="page-title"><span className="ui-inline-icon material-symbols-rounded">euro</span> Impostazioni Prezzi</h1>
          <p className="page-subtitle">
            Modifica formule, IVA e nome del prezzo riservato a installatori/ruoli autorizzati
          </p>
        </div>
      </div>

      {error && (
        <div className="login-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {savedMessage && (
        <div
          style={{
            background: 'var(--success-50)',
            border: '1px solid var(--success-100)',
            color: 'var(--success-700)',
            padding: '14px 20px',
            borderRadius: 'var(--border-radius-md)',
            marginBottom: 20,
            fontWeight: 700,
          }}
        >
          <span className="ui-inline-icon material-symbols-rounded">check_circle</span> {savedMessage}
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Formule prezzi</h3>
          </div>

          <div className="card-body">
            <div className="form-group">
              <label className="form-label">IVA %</label>
              <input
                type="number"
                className="form-control"
                value={settings.vatPercent}
                onChange={(e) => updateField('vatPercent', e.target.value)}
                step="0.01"
                min="0"
              />
              <div className="form-hint">
                Usata sia per il prezzo di listino sia per il prezzo riservato.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Ricarico prezzo di listino %</label>
              <input
                type="number"
                className="form-control"
                value={settings.listMarkupPercent}
                onChange={(e) => updateField('listMarkupPercent', e.target.value)}
                step="0.01"
              />
              <div className="form-hint">
                Formula: prezzo netto + ricarico + IVA. Lascia 0 per avere solo prezzo netto + IVA.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Nome prezzo riservato</label>
              <input
                type="text"
                className="form-control"
                value={settings.installerPriceLabel}
                onChange={(e) => updateField('installerPriceLabel', e.target.value)}
                placeholder="Es: Prezzo installatore"
              />
              <div className="form-hint">
                Questo nome sarà mostrato in inventario, dettaglio materiale ed esportazioni.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Sconto prezzo riservato %</label>
              <input
                type="number"
                className="form-control"
                value={settings.installerDiscountPercent}
                onChange={(e) => updateField('installerDiscountPercent', e.target.value)}
                step="0.01"
              />
              <div className="form-hint">
                Formula: prezzo netto - sconto + IVA. Usa 10 per il -10% attuale.
              </div>
            </div>

            <div className="btn-group" style={{ marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={resetDefaults} disabled={saving}>
                Ripristina valori iniziali
              </button>

              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Salvataggio...' : 'Salva impostazioni'}
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Anteprima calcolo</h3>
          </div>

          <div className="card-body">
            <div
              style={{
                background: 'var(--gray-50)',
                borderRadius: 'var(--border-radius-md)',
                padding: 18,
                marginBottom: 18,
              }}
            >
              <div className="text-sm text-muted fw-semibold">Prezzo netto esempio</div>
              <div style={{ fontSize: 34, fontWeight: 900 }}>
                {formatCurrency(previewNetPrice)}
              </div>
            </div>

            <div className="form-row" style={{ marginBottom: 18 }}>
              <div>
                <div className="text-sm text-muted fw-semibold">Prezzo di listino</div>
                <div style={{ fontSize: 24, fontWeight: 900 }}>
                  {formatCurrency(preview.listPrice)}
                </div>
              </div>

              <div>
                <div className="text-sm text-muted fw-semibold">
                  {settings.installerPriceLabel || 'Prezzo installatore'}
                </div>
                <div style={{ fontSize: 24, fontWeight: 900 }}>
                  {formatCurrency(preview.installerPrice)}
                </div>
              </div>
            </div>

            <div
              style={{
                padding: 14,
                borderRadius: 'var(--border-radius-md)',
                background: 'var(--primary-50)',
                color: 'var(--primary-800)',
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              <strong>Regole attive:</strong>
              <br />
              Prezzo di listino = prezzo netto + {Number(settings.listMarkupPercent || 0)}% + IVA{' '}
              {Number(settings.vatPercent || 0)}%
              <br />
              {settings.installerPriceLabel || 'Prezzo installatore'} = prezzo netto -{' '}
              {Number(settings.installerDiscountPercent || 0)}% + IVA{' '}
              {Number(settings.vatPercent || 0)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
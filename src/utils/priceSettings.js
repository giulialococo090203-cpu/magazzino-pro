import { supabase } from '../supabaseClient';

export const DEFAULT_PRICE_SETTINGS = {
  vatPercent: 22,
  listMarkupPercent: 0,
  installerDiscountPercent: 10,
  installerPriceLabel: 'Prezzo installatore',
};

const SETTINGS_KEY = 'price_settings';
const LOCAL_STORAGE_KEY = 'wm_price_settings';

function normalizeNumber(value, fallback = 0) {
  const number = Number(value);

  if (!Number.isFinite(number)) return fallback;

  return number;
}

export function normalizePriceSettings(settings = {}) {
  return {
    vatPercent: normalizeNumber(settings.vatPercent, DEFAULT_PRICE_SETTINGS.vatPercent),
    listMarkupPercent: normalizeNumber(
      settings.listMarkupPercent,
      DEFAULT_PRICE_SETTINGS.listMarkupPercent
    ),
    installerDiscountPercent: normalizeNumber(
      settings.installerDiscountPercent,
      DEFAULT_PRICE_SETTINGS.installerDiscountPercent
    ),
    installerPriceLabel:
      String(settings.installerPriceLabel || '').trim() ||
      DEFAULT_PRICE_SETTINGS.installerPriceLabel,
  };
}

export function calcListPrice(netPrice, settings = DEFAULT_PRICE_SETTINGS) {
  const normalized = normalizePriceSettings(settings);
  const net = Number(netPrice || 0);

  const withMarkup = net * (1 + normalized.listMarkupPercent / 100);
  const withVat = withMarkup * (1 + normalized.vatPercent / 100);

  return withVat;
}

export function calcInstallerPrice(netPrice, settings = DEFAULT_PRICE_SETTINGS) {
  const normalized = normalizePriceSettings(settings);
  const net = Number(netPrice || 0);

  const discounted = net * (1 - normalized.installerDiscountPercent / 100);
  const withVat = discounted * (1 + normalized.vatPercent / 100);

  return withVat;
}

export async function getPriceSettings() {
  try {
    const { data, error } = await supabase
      .from('impostazioni')
      .select('valore')
      .eq('chiave', SETTINGS_KEY)
      .maybeSingle();

    if (error) throw error;

    if (data?.valore) {
      const normalized = normalizePriceSettings(data.valore);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalized));
      return normalized;
    }
  } catch (err) {
    console.warn('Impostazioni prezzi da Supabase non leggibili, uso fallback locale:', err);
  }

  try {
    const local = localStorage.getItem(LOCAL_STORAGE_KEY);

    if (local) {
      return normalizePriceSettings(JSON.parse(local));
    }
  } catch {
    // Ignora localStorage corrotto.
  }

  return { ...DEFAULT_PRICE_SETTINGS };
}

export async function savePriceSettings(settings) {
  const normalized = normalizePriceSettings(settings);

  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalized));

  const { error } = await supabase.from('impostazioni').upsert(
    {
      chiave: SETTINGS_KEY,
      valore: normalized,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'chiave',
    }
  );

  if (error) throw error;

  window.dispatchEvent(new CustomEvent('wm_price_settings_changed', { detail: normalized }));

  return normalized;
}
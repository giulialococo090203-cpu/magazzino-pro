// ============================================================
// INITIAL DATA - Realistic mock data for the warehouse
// ============================================================

export const INITIAL_CATEGORIES = [
  { id: 'cat_1', name: 'Ferramenta', description: 'Viti, bulloni, dadi, rondelle e minuteria metallica', createdAt: '2025-01-15T08:00:00Z' },
  { id: 'cat_2', name: 'Elettrico', description: 'Cavi, interruttori, quadri, morsetti e componenti elettrici', createdAt: '2025-01-15T08:00:00Z' },
  { id: 'cat_3', name: 'Idraulica', description: 'Tubi, raccordi, valvole, guarnizioni e materiale idraulico', createdAt: '2025-01-15T08:00:00Z' },
  { id: 'cat_4', name: 'Edilizia', description: 'Cemento, calce, laterizi, malte e materiali edili', createdAt: '2025-01-15T08:00:00Z' },
  { id: 'cat_5', name: 'Sicurezza', description: 'DPI, caschi, guanti, occhiali e dispositivi di protezione', createdAt: '2025-01-15T08:00:00Z' },
  { id: 'cat_6', name: 'Utensileria', description: 'Utensili manuali e elettrici, accessori e ricambi', createdAt: '2025-01-15T08:00:00Z' },
  { id: 'cat_7', name: 'Colori e Vernici', description: 'Pitture, vernici, smalti, diluenti e accessori per verniciatura', createdAt: '2025-01-15T08:00:00Z' },
  { id: 'cat_8', name: 'Legname', description: 'Tavole, listelli, pannelli, compensati e derivati del legno', createdAt: '2025-01-15T08:00:00Z' },
];

export const INITIAL_UNITS = [
  { id: 'u_1', name: 'Pezzo', abbreviation: 'pz' },
  { id: 'u_2', name: 'Metro', abbreviation: 'm' },
  { id: 'u_3', name: 'Metro quadro', abbreviation: 'm²' },
  { id: 'u_4', name: 'Chilogrammo', abbreviation: 'kg' },
  { id: 'u_5', name: 'Litro', abbreviation: 'l' },
  { id: 'u_6', name: 'Scatola', abbreviation: 'scat' },
  { id: 'u_7', name: 'Confezione', abbreviation: 'conf' },
  { id: 'u_8', name: 'Rotolo', abbreviation: 'rot' },
  { id: 'u_9', name: 'Sacco', abbreviation: 'sac' },
  { id: 'u_10', name: 'Pallet', abbreviation: 'plt' },
];

export const INITIAL_MATERIALS = [
  { id: 'mat_1', code: 'FER-001', description: 'Viti autofilettanti 4x30mm', brand: 'Fischer', category: 'cat_1', quantity: 2500, unit: 'pz', minThreshold: 500, status: 'disponibile', location: 'A1-01', supplier: 'Würth Italia', notes: '' },
  { id: 'mat_2', code: 'FER-002', description: 'Bulloni esagonali M8x40', brand: 'Ambrovit', category: 'cat_1', quantity: 800, unit: 'pz', minThreshold: 200, status: 'disponibile', location: 'A1-02', supplier: 'Würth Italia', notes: '' },
  { id: 'mat_3', code: 'FER-003', description: 'Tasselli nylon 8mm', brand: 'Fischer', category: 'cat_1', quantity: 150, unit: 'pz', minThreshold: 300, status: 'sotto_soglia', location: 'A1-03', supplier: 'Fischer Italia', notes: 'Ordinare urgente' },
  { id: 'mat_4', code: 'FER-004', description: 'Rondelle piane M10', brand: 'Ambrovit', category: 'cat_1', quantity: 3000, unit: 'pz', minThreshold: 500, status: 'disponibile', location: 'A1-04', supplier: 'Ambrovit Srl', notes: '' },
  { id: 'mat_5', code: 'ELE-001', description: 'Cavo elettrico unipolare 2.5mm² blu', brand: 'Baldassari Cavi', category: 'cat_2', quantity: 450, unit: 'm', minThreshold: 100, status: 'disponibile', location: 'B1-01', supplier: 'Elettroveneta', notes: '' },
  { id: 'mat_6', code: 'ELE-002', description: 'Interruttore magnetotermico 16A', brand: 'ABB', category: 'cat_2', quantity: 25, unit: 'pz', minThreshold: 10, status: 'disponibile', location: 'B1-02', supplier: 'ABB Italia', notes: '' },
  { id: 'mat_7', code: 'ELE-003', description: 'Morsetti a cappuccio 4mm²', brand: 'Wago', category: 'cat_2', quantity: 5, unit: 'conf', minThreshold: 10, status: 'sotto_soglia', location: 'B1-03', supplier: 'Elettroveneta', notes: 'In attesa ordine' },
  { id: 'mat_8', code: 'ELE-004', description: 'Tubo corrugato 25mm', brand: 'Gewiss', category: 'cat_2', quantity: 200, unit: 'm', minThreshold: 50, status: 'disponibile', location: 'B1-04', supplier: 'Gewiss Spa', notes: '' },
  { id: 'mat_9', code: 'IDR-001', description: 'Tubo multistrato 20mm', brand: 'Giacomini', category: 'cat_3', quantity: 300, unit: 'm', minThreshold: 50, status: 'disponibile', location: 'C1-01', supplier: 'Giacomini Spa', notes: '' },
  { id: 'mat_10', code: 'IDR-002', description: 'Raccordo a T 1/2"', brand: 'Caleffi', category: 'cat_3', quantity: 0, unit: 'pz', minThreshold: 20, status: 'esaurito', location: 'C1-02', supplier: 'Caleffi Spa', notes: 'ESAURITO - riordino urgente' },
  { id: 'mat_11', code: 'IDR-003', description: 'Valvola a sfera 3/4"', brand: 'Caleffi', category: 'cat_3', quantity: 45, unit: 'pz', minThreshold: 15, status: 'disponibile', location: 'C1-03', supplier: 'Caleffi Spa', notes: '' },
  { id: 'mat_12', code: 'EDL-001', description: 'Cemento Portland 325 R', brand: 'Buzzi Unicem', category: 'cat_4', quantity: 80, unit: 'sac', minThreshold: 30, status: 'disponibile', location: 'D1-01', supplier: 'Buzzi Unicem', notes: 'Conservare al coperto' },
  { id: 'mat_13', code: 'EDL-002', description: 'Malta bastarda pronta', brand: 'Mapei', category: 'cat_4', quantity: 15, unit: 'sac', minThreshold: 20, status: 'sotto_soglia', location: 'D1-02', supplier: 'Mapei Spa', notes: '' },
  { id: 'mat_14', code: 'EDL-003', description: 'Colla per piastrelle C2', brand: 'Mapei', category: 'cat_4', quantity: 40, unit: 'sac', minThreshold: 10, status: 'disponibile', location: 'D1-03', supplier: 'Mapei Spa', notes: '' },
  { id: 'mat_15', code: 'SIC-001', description: 'Guanti da lavoro nitrile tg. L', brand: '3M', category: 'cat_5', quantity: 30, unit: 'conf', minThreshold: 10, status: 'disponibile', location: 'E1-01', supplier: '3M Italia', notes: 'Conf. da 100 pz' },
  { id: 'mat_16', code: 'SIC-002', description: 'Casco protettivo ABS giallo', brand: 'Deltaplus', category: 'cat_5', quantity: 8, unit: 'pz', minThreshold: 10, status: 'sotto_soglia', location: 'E1-02', supplier: 'Deltaplus Italia', notes: '' },
  { id: 'mat_17', code: 'SIC-003', description: 'Occhiali protettivi antigraffio', brand: 'Uvex', category: 'cat_5', quantity: 22, unit: 'pz', minThreshold: 10, status: 'disponibile', location: 'E1-03', supplier: 'Uvex Italia', notes: '' },
  { id: 'mat_18', code: 'UTN-001', description: 'Trapano avvitatore 18V', brand: 'Makita', category: 'cat_6', quantity: 6, unit: 'pz', minThreshold: 3, status: 'disponibile', location: 'F1-01', supplier: 'Makita Italia', notes: '' },
  { id: 'mat_19', code: 'UTN-002', description: 'Set punte HSS 1-10mm', brand: 'Bosch', category: 'cat_6', quantity: 12, unit: 'conf', minThreshold: 5, status: 'disponibile', location: 'F1-02', supplier: 'Bosch Professional', notes: '' },
  { id: 'mat_20', code: 'CLR-001', description: 'Pittura murale bianca 14L', brand: 'Boero', category: 'cat_7', quantity: 18, unit: 'pz', minThreshold: 5, status: 'disponibile', location: 'G1-01', supplier: 'Boero Bartolomeo', notes: '' },
  { id: 'mat_21', code: 'CLR-002', description: 'Smalto antiruggine grigio 0.75L', brand: 'Saratoga', category: 'cat_7', quantity: 0, unit: 'pz', minThreshold: 8, status: 'esaurito', location: 'G1-02', supplier: 'Saratoga Sforza', notes: 'ESAURITO' },
  { id: 'mat_22', code: 'LGN-001', description: 'Tavola abete grezzo 200x20x2 cm', brand: 'Cortinovis Legnami', category: 'cat_8', quantity: 50, unit: 'pz', minThreshold: 15, status: 'disponibile', location: 'H1-01', supplier: 'Cortinovis Legnami', notes: '' },
  { id: 'mat_23', code: 'LGN-002', description: 'Pannello OSB 250x125 cm 18mm', brand: 'Egger', category: 'cat_8', quantity: 12, unit: 'pz', minThreshold: 5, status: 'disponibile', location: 'H1-02', supplier: 'Egger Italia', notes: '' },
  { id: 'mat_24', code: 'FER-005', description: 'Chiodi acciaio 3x60mm', brand: 'Bea', category: 'cat_1', quantity: 0, unit: 'kg', minThreshold: 10, status: 'esaurito', location: 'A1-05', supplier: 'Bea Srl', notes: 'ESAURITO - in attesa consegna' },
];

const generateMovementHistory = () => {
  const types = ['entrata', 'uscita', 'reintegro'];
  const reasons = ['uso_interno', 'cliente', 'reso', 'materiale_non_utilizzato'];
  const users = ['user_op1', 'user_op2', 'user_seg'];
  const userNames = { 'user_op1': 'Marco Rossi', 'user_op2': 'Luigi Verdi', 'user_seg': 'Anna Bianchi' };
  const movements = [];

  INITIAL_MATERIALS.forEach(mat => {
    const numMov = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < numMov; i++) {
      const daysAgo = Math.floor(Math.random() * 60);
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      date.setHours(8 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 60));
      const type = types[Math.floor(Math.random() * types.length)];
      const userId = users[Math.floor(Math.random() * users.length)];
      const qty = type === 'uscita'
        ? Math.max(1, Math.floor(Math.random() * 20))
        : Math.max(1, Math.floor(Math.random() * 50));

      movements.push({
        id: `mov_${mat.id}_${i}`,
        materialId: mat.id,
        materialCode: mat.code,
        materialDescription: mat.description,
        categoryId: mat.category,
        type,
        quantity: qty,
        previousQty: mat.quantity,
        newQty: type === 'uscita' ? mat.quantity - qty : mat.quantity + qty,
        userId,
        userName: userNames[userId],
        reason: reasons[Math.floor(Math.random() * reasons.length)],
        notes: '',
        date: date.toISOString(),
        timestamp: date.getTime(),
      });
    }
  });

  return movements.sort((a, b) => b.date.localeCompare(a.date));
};

export const INITIAL_MOVEMENTS = generateMovementHistory();

export const INITIAL_USERS = []; // Deprecato in favore del DB Supabase

export const INITIAL_NOTIFICATIONS = [
  { id: 'notif_1', type: 'sotto_soglia', materialId: 'mat_3', materialCode: 'FER-003', materialDescription: 'Tasselli nylon 8mm', currentQty: 150, threshold: 300, message: 'FER-003 - Tasselli nylon 8mm: quantità (150) sotto soglia minima (300)', read: false, createdAt: '2026-04-15T10:00:00Z' },
  { id: 'notif_2', type: 'sotto_soglia', materialId: 'mat_7', materialCode: 'ELE-003', materialDescription: 'Morsetti a cappuccio 4mm²', currentQty: 5, threshold: 10, message: 'ELE-003 - Morsetti a cappuccio 4mm²: quantità (5) sotto soglia minima (10)', read: false, createdAt: '2026-04-15T11:00:00Z' },
  { id: 'notif_3', type: 'sotto_soglia', materialId: 'mat_10', materialCode: 'IDR-002', materialDescription: 'Raccordo a T 1/2"', currentQty: 0, threshold: 20, message: 'IDR-002 - Raccordo a T 1/2": ESAURITO (soglia: 20)', read: false, createdAt: '2026-04-14T09:00:00Z' },
  { id: 'notif_4', type: 'sotto_soglia', materialId: 'mat_13', materialCode: 'EDL-002', materialDescription: 'Malta bastarda pronta', currentQty: 15, threshold: 20, message: 'EDL-002 - Malta bastarda pronta: quantità (15) sotto soglia minima (20)', read: false, createdAt: '2026-04-14T14:00:00Z' },
  { id: 'notif_5', type: 'sotto_soglia', materialId: 'mat_16', materialCode: 'SIC-002', materialDescription: 'Casco protettivo ABS giallo', currentQty: 8, threshold: 10, message: 'SIC-002 - Casco protettivo ABS giallo: quantità (8) sotto soglia minima (10)', read: false, createdAt: '2026-04-13T16:00:00Z' },
  { id: 'notif_6', type: 'sotto_soglia', materialId: 'mat_21', materialCode: 'CLR-002', materialDescription: 'Smalto antiruggine grigio 0.75L', currentQty: 0, threshold: 8, message: 'CLR-002 - Smalto antiruggine grigio 0.75L: ESAURITO (soglia: 8)', read: false, createdAt: '2026-04-12T08:00:00Z' },
  { id: 'notif_7', type: 'sotto_soglia', materialId: 'mat_24', materialCode: 'FER-005', materialDescription: 'Chiodi acciaio 3x60mm', currentQty: 0, threshold: 10, message: 'FER-005 - Chiodi acciaio 3x60mm: ESAURITO (soglia: 10)', read: false, createdAt: '2026-04-11T12:00:00Z' },
];

export function initializeData() {
  // Funzione deprecata in favore della persistenza reale su Supabase.
  // I dati iniziali possono essere usati per il seeding manuale del database.
  console.log('Persistenza migrata su Supabase.');
}

export const MOVEMENT_TYPES = [
  { value: 'entrata', label: 'Entrata', color: '#22c55e' },
  { value: 'uscita', label: 'Uscita', color: '#ef4444' },
  { value: 'reintegro', label: 'Reintegro', color: '#3b82f6' },
  { value: 'rettifica', label: 'Rettifica Inventario', color: '#f59e0b' },
];

export const MOVEMENT_REASONS = [
  { value: 'uso_interno', label: 'Uso interno' },
  { value: 'cliente', label: 'Cliente' },
  { value: 'reso', label: 'Reso' },
  { value: 'errore_inventario', label: 'Errore inventario' },
  { value: 'materiale_non_utilizzato', label: 'Materiale non utilizzato' },
  { value: 'manutenzione', label: 'Manutenzione' },
  { value: 'campione', label: 'Campione / Prova' },
  { value: 'altro', label: 'Altro' },
];

export const USER_ROLES = [
  { value: 'admin', label: 'Amministratore', description: 'Accesso completo a tutte le funzionalità' },
  { value: 'operatore', label: 'Operatore', description: 'Registra movimenti e consulta disponibilità' },
  { value: 'segreteria', label: 'Segreteria', description: 'Registra movimenti, consulta e esporta dati' },
  { value: 'controllo', label: 'Controllo / Supervisore', description: 'Monitoraggio, dashboard e grafici' },
];

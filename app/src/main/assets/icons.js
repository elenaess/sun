const OFFICIAL_EPISODES = [
  {id:'2B_njMCRCvU',title:'Gundam: The Witch from Mercury',caption:'Episódio 1 · oficial'},
  {id:'9isbRbLD2GE',title:'Gundam Unicorn RE:0096',caption:'Episódio 1 · oficial'},
  {id:'U10iG69axKc',title:'Gundam SEED HD Remaster',caption:'Episódio 1 · oficial'},
  {id:'YYqJMKhaLhk',title:'Mobile Suit Gundam — Filme I',caption:'Filme completo · oficial'}
];
const ICONS = {
 home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
 library:'<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M7 6V3h10v3m-7 5 5 3-5 3z"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 check:'<path d="m5 12 4 4L19 6"/>',
 play:'<path d="m8 5 12 7-12 7z"/>',
 heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
 back:'<path d="m15 18-6-6 6-6"/>',
 chevron:'<path d="m9 18 6-6-6-6"/>',
 close:'<path d="M18 6 6 18M6 6l12 12"/>',
 external:'<path d="M14 4h6v6M20 4l-9 9M20 14v6H4V4h6"/>',
 star:'<path d="m12 3 2.7 5.8L21 10l-4.5 4.4 1 6.3L12 17.7l-5.5 3 1-6.3L3 10l6.3-1.2z"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
 moon:'<path d="M21 15a8.5 8.5 0 0 1-12-12A9 9 0 1 0 21 15"/>',
 upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v4h16v-4"/>',
 download:'<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
 film:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="m3 9 18-4M8 5l3 4m3-4 3 3"/>',
 tv:'<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M8 2l4 4 4-4"/>',
 info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6m0-11v1"/>',
 refresh:'<path d="M20 7V3l-4 4a8 8 0 1 0 3 10"/>',
 shield:'<path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5z"/>',
 share:'<path d="M12 16V3m-5 5 5-5 5 5M5 13v8h14v-8"/>',
 dots:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
};
function icon(name,size=20){return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]||ICONS.info}</svg>`;}
function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

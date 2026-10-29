// Level registry. To add a level: create data/<id>.js (same shape as a1.js, built by tools/build_level_<id>.py),
// then set ready:true here.
window.LEVELS = [
  { id: 'a1', title: 'A1', name: 'Deutsch A1 kompakt', sub: 'শুরুর স্তর · Goethe Start Deutsch 1', ready: true, file: 'data/a1.js' },
  { id: 'a2', title: 'A2', name: 'Deutsch A2', sub: 'শীঘ্রই আসছে', ready: false, file: 'data/a2.js' },
  { id: 'b1', title: 'B1', name: 'Deutsch B1', sub: 'শীঘ্রই আসছে', ready: false, file: 'data/b1.js' },
  { id: 'b2', title: 'B2', name: 'Deutsch B2', sub: 'শীঘ্রই আসছে', ready: false, file: 'data/b2.js' }
];

const fs = require('fs');
const content = fs.readFileSync('/src/App.tsx', 'utf8');

// The lines we want to remove are between line 1150 and 1163 approx.
// We'll target the unique strings.

let updated = content.replace(/isDark \? "border-white\/20 bg-black" : "border-slate-200 bg-white shadow-slate-200\/50"/g, '');
updated = updated.replace(/\)\}>/g, (match, offset) => {
    // We only want to remove the ones in the broken range.
    // Line 1151 is around offset 45800.
    if (offset > 45000 && offset < 46000) return '';
    return match;
});

// Remove things that look like the broken img block
updated = updated.replace(/<div className="w-full h-full rounded-full border border-white\/10 overflow-hidden bg-white">/g, (match, offset) => {
    if (offset > 45000 && offset < 46000) return '';
    return match;
});

fs.writeFileSync('/src/App.tsx', updated);

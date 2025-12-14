import sdeService from '../services/sde.js';
import blueprintService from '../services/blueprintService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🔍 Analyzing all groupIDs used in production...\n');

await sdeService.loadTypes();
await blueprintService.loadBlueprints();

const blueprints = blueprintService.getAllBlueprints();
const groupIdMap = new Map(); // groupId -> Set of item names

// Scan all blueprints
blueprints.forEach(bp => {
  // Check products
  if (bp.activities?.manufacturing?.products) {
    bp.activities.manufacturing.products.forEach(prod => {
      const type = sdeService.getTypeById(prod.typeID);
      if (type?.groupId) {
        if (!groupIdMap.has(type.groupId)) {
          groupIdMap.set(type.groupId, new Set());
        }
        groupIdMap.get(type.groupId).add(type.name);
      }
    });
  }
  
  // Check reaction products
  if (bp.activities?.reaction?.products) {
    bp.activities.reaction.products.forEach(prod => {
      const type = sdeService.getTypeById(prod.typeID);
      if (type?.groupId) {
        if (!groupIdMap.has(type.groupId)) {
          groupIdMap.set(type.groupId, new Set());
        }
        groupIdMap.get(type.groupId).add(type.name);
      }
    });
  }
});

// Get group names from groups.jsonl
const groupsFile = path.join(__dirname, '../../eve-online-static-data-3133773-jsonl/groups.jsonl');
const groupNames = new Map();

fs.readFileSync(groupsFile, 'utf8').split('\n').forEach(line => {
  if (line.trim()) {
    const group = JSON.parse(line);
    groupNames.set(group._key, group.name?.en || 'Unknown');
  }
});

// Sort and display
const sortedIds = Array.from(groupIdMap.keys()).sort((a, b) => a - b);

console.log(`Total unique groupIDs: ${sortedIds.length}\n`);
console.log('=' .repeat(100));

sortedIds.forEach(groupId => {
  const items = Array.from(groupIdMap.get(groupId)).sort();
  const groupName = groupNames.get(groupId) || 'Unknown Group';
  
  console.log(`\nGroupID ${groupId}: ${groupName}`);
  console.log(`  Items (${items.length}):`);
  items.slice(0, 5).forEach(item => {
    console.log(`    - ${item}`);
  });
  if (items.length > 5) {
    console.log(`    ... and ${items.length - 5} more`);
  }
});

console.log('\n' + '='.repeat(100));
console.log('\n📋 GroupIDs organized by count:\n');

const sortedByCount = Array.from(groupIdMap.entries())
  .sort((a, b) => b[1].size - a[1].size)
  .slice(0, 30);

sortedByCount.forEach(([groupId, items]) => {
  const groupName = groupNames.get(groupId) || 'Unknown';
  console.log(`  ${groupId.toString().padStart(5)} (${items.size.toString().padStart(4)} items) - ${groupName}`);
});

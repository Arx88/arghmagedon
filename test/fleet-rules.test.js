import test from 'node:test';
import assert from 'node:assert/strict';
import {supportProfiles,supportPurchaseAllowed,equipSupport} from '../src/fleet-rules.js';
import {createShip} from '../src/ship-designs.js';
import {fleetSailIdentity} from '../src/fleet-appearance.js';

test('corsairs and guards share escort capacity; destroyed hulls release places',()=>{
 const ships=Array.from({length:3},(_,i)=>({team:'blue',support:'guard',unitKind:i?'guard':'corsair'}));
 assert.equal(supportPurchaseAllowed('corsair',ships),false);
 assert.equal(supportPurchaseAllowed('guard',ships),false);
 assert.equal(supportPurchaseAllowed('scout',ships),true);
 ships[0].destroyed=true;
 assert.equal(supportPurchaseAllowed('corsair',ships),true);
 assert.equal(supportPurchaseAllowed('unknown',ships),false);
 assert.equal(supportPurchaseAllowed('guard',ships,'red'),true);
});
test('corsair tradeoffs affect real broadside clocks and preserve distinct two-mast rigging',()=>{
 const s={guns:{port:{left:5,total:5},starboard:{left:5,total:5}}};
 equipSupport(s,'corsair');
 assert(s.hp<supportProfiles.guard.hp);assert(s.maxSpeed>supportProfiles.guard.speed);assert(s.damage>supportProfiles.guard.damage);
 assert.equal(s.guns.port.total,s.reload);assert.equal(s.guns.starboard.left,0);assert.equal(s.support,'guard');
 const ship=createShip('blue',.72,'corsair');
 assert.equal(ship.userData.sails.filter(r=>r.userData.sailKind==='lateen').length,2);
 assert.equal(ship.userData.cannons.length,8);
 assert.equal(fleetSailIdentity({variant:'corsair',support:'guard'}),null);
 assert.throws(()=>equipSupport({},'invalid'),RangeError);
});

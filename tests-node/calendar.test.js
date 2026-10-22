import {test} from 'node:test';
import assert from 'node:assert/strict';
import {persianParts,monthDays} from '../calendar.js';
test('Nowruz and leap-year boundaries map to actual Gregorian days',()=>{
 assert.deepEqual(persianParts('2025-03-21'),{year:1404,month:1,day:1});
 assert.deepEqual(persianParts('2024-03-20'),{year:1403,month:1,day:1});
 assert.equal(monthDays(1399,12).length,30);assert.equal(monthDays(1400,12).length,29);
 assert.equal(monthDays(1404,1).length,31);assert.equal(monthDays(1404,7).length,30);
 assert.equal(monthDays(1404,1)[0].iso,'2025-03-21');assert.equal(monthDays(1404,1)[0].weekday,6);
});

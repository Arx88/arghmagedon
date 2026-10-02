/** Choose one actionable message from the live match, without revealing hidden enemies. */
export function tacticalGuidance({ player, home, docked, bank, nearby, target, loot, invasion }) {
  const message = (id, title, detail, tone = 'calm') => ({ id, title, detail, tone });
  if (player.dead) return message('return', 'La revancha sigue a flote', 'Tu tripulación prepara otro barco. Volverás a salir desde tu base.');
  if (home?.invasion && home.invasion.team !== player.team) return message('defend', '¡Defiende Puerto Ron Ron!', 'La base está siendo invadida. Vuelve y elimina a los atacantes.', 'danger');
  if (player.burning > 0) return message('fire', '¡Fuego a bordo!', 'Pulsa V para sofocar las llamas. Sal del rastro de fuego enemigo.', 'danger');
  if (player.hp < player.maxHp * .38) return message('repair', 'Pon tu casco a salvo', 'Vuelve a tu puerto: el casco se repara mientras estás amarrado.', 'danger');
  if (invasion) return message('capture', 'Sostén el desembarco', 'Mantente cerca de la isla y protege a tu tripulación hasta plantar la bandera.');
  if (loot) return message('loot', 'La tripulación está saqueando', 'Cubre la costa. Al completar el saqueo, lleva el oro a puerto.');
  if (target && !target.dead && target.object?.visible) return message('combat', 'Muéstrales tu costado', 'Alinea los cañones con el rival. Mantén ESPACIO para lanzar andanadas.', 'combat');
  if (player.gold > 0) return message('deposit', 'Asegura el botín', `${player.gold} de oro a bordo. Llévalo a Ron Ron para poder gastarlo.`);
  if (nearby && nearby.discovered && nearby.owner !== player.team) {
    if (nearby.tower && !nearby.tower.dead) return message('tower', 'Primero, derriba su torre', 'Usa tus cañones para abrir paso antes de desembarcar.');
    return message('land', 'Echa mano a esa isla', 'Acércate y pulsa E para desembarcar. Lleva suficientes tripulantes.');
  }
  if (docked) return message('provision', 'Prepara tu próxima salida', `${bank} de oro en caja. Pulsa F para equiparte; después, pon rumbo a un cayo.`);
  return message('explore', 'Haz fortuna. Toma su bandera.', 'Saquea islas, refuerza tu flota y conquista el Diente Roto.');
}

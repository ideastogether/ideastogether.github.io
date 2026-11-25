(function(root){
  const ageYears=[0,1,2,3,4,6,6,8,10];
  const durations={'5 分鐘內':5,'5–15 分鐘':15,'15–30 分鐘':30,'30 分鐘以上':Infinity};
  const published=games=>games.filter(g=>g.status==='approved');
  function filter(games,{age='',time='',scene='',materials=null,abilities=[]}={}){
    return published(games).filter(g=>(age===''||ageYears[g.age]<=Number(age))&&
      (time===''||(Object.hasOwn(durations,g.duration_label)&&durations[g.duration_label]<=Number(time)))&&
      (!scene||(g.tags||[]).includes(scene))&&
      (materials===null||(g.materials||[]).every(m=>materials.includes(m)))&&
      abilities.every(a=>(g.abilities||[]).includes(a)));
  }
  function pick(games,previous=[],random=Math.random){
    const shuffled=games.map(g=>({g,key:random()})).sort((a,b)=>a.key-b.key).map(x=>x.g);
    return [...shuffled.filter(g=>!previous.includes(g.id)),...shuffled.filter(g=>previous.includes(g.id))].slice(0,3);
  }
  function daily(games,now=new Date()){
    const rows=published(games).slice().sort((a,b)=>a.id.localeCompare(b.id));
    const day=Math.floor((now.getTime()+8*3600000)/86400000);
    return rows.length?rows[day%rows.length]:null;
  }
  root.GameDiscovery={filter,pick,daily,ageYears};
})(globalThis);

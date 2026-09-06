// Rebuild after downloading https://raw.githubusercontent.com/mwgg/Airports/master/airports.json
// as airports-source.json in this directory. Source data: MIT, see AIRPORTS-LICENSE.txt.
const fs = require('node:fs');
const path = require('node:path');
const source = JSON.parse(fs.readFileSync(path.join(__dirname, 'airports-source.json'), 'utf8'));
const regions = new Intl.DisplayNames(['zh-CN'], {type:'region'});
const cities = {
  Doha:'多哈', Jakarta:'雅加达', Singapore:'新加坡', 'Hong Kong':'香港', Seoul:'首尔',
  Tokyo:'东京', Osaka:'大阪', Nagoya:'名古屋', Fukuoka:'福冈', Sapporo:'札幌', Naha:'那霸',
  Beijing:'北京', Shanghai:'上海', Guangzhou:'广州', Shenzhen:'深圳', Chengdu:'成都',
  Hangzhou:'杭州', Xiamen:'厦门', Dalian:'大连', Qingdao:'青岛', Tianjin:'天津',
  Taipei:'台北', Kaohsiung:'高雄', Macau:'澳门', Bangkok:'曼谷', Phuket:'普吉',
  'Kuala Lumpur':'吉隆坡', Manila:'马尼拉', Hanoi:'河内', 'Ho Chi Minh City':'胡志明市',
  'Da Nang':'岘港', Denpasar:'登巴萨', 'Phnom Penh':'金边', Busan:'釜山', Jeju:'济州',
  Dubai:'迪拜', 'Abu Dhabi':'阿布扎比', Istanbul:'伊斯坦布尔', Delhi:'德里', Mumbai:'孟买',
  London:'伦敦', Paris:'巴黎', Frankfurt:'法兰克福', Munich:'慕尼黑', Amsterdam:'阿姆斯特丹',
  Helsinki:'赫尔辛基', Vienna:'维也纳', Zurich:'苏黎世', Rome:'罗马', Milan:'米兰',
  Madrid:'马德里', 'Los Angeles':'洛杉矶', 'San Francisco':'旧金山', 'New York':'纽约',
  Seattle:'西雅图', Chicago:'芝加哥', Boston:'波士顿', Honolulu:'檀香山',
  Vancouver:'温哥华', Toronto:'多伦多', Sydney:'悉尼', Melbourne:'墨尔本',
  Brisbane:'布里斯班', Perth:'珀斯', Auckland:'奥克兰'
};
const locations = {};
const aliases = {};
for (const a of Object.values(source)) {
  if (!a.iata || !a.city || !/^[A-Z]{2}$/.test(a.country)) continue;
  const country = a.country === 'HK' || a.country === 'MO' ? '中国' : regions.of(a.country);
  locations[a.iata] = `${country} · ${cities[a.city] || a.city}`;
  aliases[a.icao] = a.iata;
}
fs.writeFileSync(path.join(__dirname, '../airport-locations.js'),
  '// Airport locations: mwgg/Airports (MIT). See data/AIRPORTS-LICENSE.txt.\n' +
  'window.AIRPORT_LOCATIONS = ' + JSON.stringify(locations) + ';\n' +
  'window.AIRPORT_ICAO_CODES = ' + JSON.stringify(aliases) + ';\n');
console.log(`Generated ${Object.keys(locations).length} airport locations.`);

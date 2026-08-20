const fs=require('fs'); const {page}=require('./shell.js');
const models=[...require('./data1.js'),...require('./data2.js'),...require('./data3.js')];
fs.mkdirSync('out',{recursive:true});
for(const m of models){ fs.writeFileSync('out/'+m.slug+'.html', page(m)); }
fs.writeFileSync('manifest.json', JSON.stringify(models.map(m=>({slug:m.slug,title:m.title,favicon:m.favicon,desc:m.desc,status:m.status,kicker:m.kicker})),null,1));
console.log(models.length+' pages built');
for(const m of models) console.log('  '+m.slug.padEnd(26)+m.title.padEnd(28)+m.favicon+'  '+(fs.statSync('out/'+m.slug+'.html').size/1024).toFixed(1)+' KB');

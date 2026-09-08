
var metaData=[],shopeeData=[],shopeeClickData=[],activePlatforms=new Set(),activeAkuns=new Set(),activeWorkspaces=new Set(),rawMin='',rawMax='',rawMinMeta='',rawMaxMeta='',rawMinShopee='',rawMaxShopee='',activeTab='overview',charts={},campSortKey='spend',campSortDir=-1,expandedCampaign='',attrSort={key:'comm',dir:'desc'},attrFilters={minSpend:'',maxSpend:''};
var TARGET=500000;
function getTarget(){return parseInt(document.getElementById('target-input')&&document.getElementById('target-input').value.replace(/[^0-9]/g,'')||TARGET)||TARGET;}

// ─── WORKSPACE STATE ───
var workspaces=[];
var nextWsId=1;
var nextAkunId=1;

function escHtml(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function addWorkspace(){
  var id=nextWsId++;
  workspaces.push({
    id:id,
    name:'',
    metaRaw:null,metaDone:false,metaFname:'',
    clickRaw:null,clickDone:false,clickFname:'',
    shopeeAccounts:[{id:nextAkunId++,label:'',raw:null,done:false,fname:''}],
    collapsed:false
  });
  renderWorkspaces();
  checkReady();
}

function removeWorkspace(wsId){
  if(workspaces.length<=1) return;
  workspaces=workspaces.filter(function(w){return w.id!==wsId;});
  renderWorkspaces();
  checkReady();
}

function toggleWorkspace(wsId){
  var ws=workspaces.find(function(w){return w.id===wsId;});
  if(ws) ws.collapsed=!ws.collapsed;
  renderWorkspaces();
}

function addShopeeToWorkspace(wsId){
  var ws=workspaces.find(function(w){return w.id===wsId;});
  if(!ws) return;
  ws.shopeeAccounts.push({id:nextAkunId++,label:'',raw:null,done:false,fname:''});
  renderWorkspaces();
}

function removeShopeeFromWorkspace(wsId,akunId){
  var ws=workspaces.find(function(w){return w.id===wsId;});
  if(!ws||ws.shopeeAccounts.length<=1) return;
  ws.shopeeAccounts=ws.shopeeAccounts.filter(function(a){return a.id!==akunId;});
  renderWorkspaces();
}

function isWorkspaceReady(ws){
  return ws.metaDone && ws.shopeeAccounts.some(function(a){return a.done;});
}

var shopeeAccounts=[];

function getAttributionSortValue(t,key){
  var net=(t.comm||0)-(t.spend||0);
  var map={
    tag:t.tag||'',
    akun:t.akunLabel||'',
    match:t.matchedCamp||'',
    spend:t.spend||0,
    comm:t.comm||0,
    net:net,
    roas:t.roas||0,
    roi:t.spend?net/t.spend:0,
    cpc:t.cpc||0,
    epc:t.epc||0,
    newUser:t.newUserCount||0,
    reco:(t.reco&&t.reco.label)||'',
    orders:t.orderCount||0,
    avgOrder:t.orderCount?(t.comm||0)/t.orderCount:0,
    realCpc:t.realCpc||0,
    realRate:t.shopeeClickRate||0
  };
  return Object.prototype.hasOwnProperty.call(map,key)?map[key]:map.comm;
}
function sortAttributionTags(tags,key,dir){
  var mult=dir==='asc'?1:-1;
  return (tags||[]).slice().sort(function(a,b){
    var av=getAttributionSortValue(a,key),bv=getAttributionSortValue(b,key);
    if(typeof av==='string'||typeof bv==='string'){
      return String(av||'').localeCompare(String(bv||''),'id',{numeric:true,sensitivity:'base'})*mult;
    }
    return ((av||0)-(bv||0))*mult;
  });
}
function parseAttrNumber(v){
  if(v===undefined||v===null||v==='') return null;
  var n=parseFloat(String(v).replace(/[^0-9.-]/g,''));
  return Number.isFinite(n)?n:null;
}
function filterAttributionTags(tags,filters){
  filters=filters||{};
  var minSpend=parseAttrNumber(filters.minSpend);
  var maxSpend=parseAttrNumber(filters.maxSpend);
  return (tags||[]).filter(function(t){
    var spend=t.spend||0;
    if(minSpend!==null&&spend<minSpend) return false;
    if(maxSpend!==null&&spend>maxSpend) return false;
    return true;
  });
}
function getAttributionSortArrow(key,state){
  state=state||attrSort;
  if(!state||state.key!==key) return '';
  return state.dir==='asc'?' ↑':' ↓';
}
function thAttrSort(label,key,html){
  var active=attrSort&&attrSort.key===key;
  var cls='sortable '+(active?attrSort.dir:'');
  return '<th class="'+cls+'" data-attr-sort="'+key+'" title="Klik untuk urutkan '+escHtml(label)+'">'+(html||escHtml(label))+getAttributionSortArrow(key)+'</th>';
}

function renderWorkspaces(){
  var list=document.getElementById('workspace-list');
  if(!list) return;
  list.innerHTML='';
  workspaces.forEach(function(ws,wi){
    var ready=isWorkspaceReady(ws);
    var card=document.createElement('div');
    card.className='ws-card'+(ready?' ws-ready':'')+(ws.collapsed?' ws-collapsed':'');

    var hdr=document.createElement('div');
    hdr.className='ws-card-header';
    hdr.addEventListener('click',function(e){
      if(e.target.closest('.ws-remove-btn')) return;
      toggleWorkspace(ws.id);
    });

    var badge=document.createElement('div');
    badge.className='ws-badge';
    badge.textContent=wi+1;

    var nameInp=document.createElement('input');
    nameInp.className='ws-name-input';
    nameInp.type='text';
    nameInp.placeholder='Nama workspace (contoh: Aisyah Store)';
    nameInp.value=ws.name||'';
    nameInp.addEventListener('click',function(e){e.stopPropagation();});
    nameInp.addEventListener('input',function(){ws.name=this.value;});

    var statusBadge=document.createElement('span');
    statusBadge.className='ws-status-badge';
    var metaDone=ws.metaDone;
    var shopDone=ws.shopeeAccounts.filter(function(a){return a.done;}).length;
    statusBadge.textContent=ready?'✓ Siap':(metaDone?'Meta ✓':'Meta —')+' · Shopee '+shopDone+'/'+ws.shopeeAccounts.length;

    var chev=document.createElement('span');
    chev.className='ws-chevron';
    chev.textContent='▾';

    hdr.appendChild(badge);
    hdr.appendChild(nameInp);
    hdr.appendChild(statusBadge);
    hdr.appendChild(chev);

    if(workspaces.length>1){
      var rmBtn=document.createElement('button');
      rmBtn.className='ws-remove-btn';
      rmBtn.textContent='×';
      rmBtn.title='Hapus workspace';
      rmBtn.addEventListener('click',function(e){e.stopPropagation();removeWorkspace(ws.id);});
      hdr.appendChild(rmBtn);
    }

    card.appendChild(hdr);

    if(!ws.collapsed){
      var body=document.createElement('div');
      body.className='ws-body';

      var metaLabel=document.createElement('div');
      metaLabel.className='ws-section-label';
      metaLabel.textContent='Meta Ads CSV — breakdown by Campaign + Day';
      body.appendChild(metaLabel);

      var metaSlot=document.createElement('div');
      metaSlot.className='meta-slot'+(ws.metaDone?' done':'');

      var metaIcon=document.createElement('div');
      metaIcon.className='meta-slot-icon';
      metaIcon.innerHTML=ws.metaDone
        ? '<svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7C4 5.34 5.34 4 7 4h10c1.66 0 3 1.34 3 3v10c0 1.66-1.34 3-3 3H7c-1.66 0-3-1.34-3-3V7z" stroke="rgba(238,77,45,.7)" stroke-width="1.5"/><path d="M9 12h6M12 9v6" stroke="rgba(238,77,45,.7)" stroke-width="1.5" stroke-linecap="round"/></svg>';

      var metaBody=document.createElement('div');
      metaBody.className='meta-slot-body';
      var metaTitle=document.createElement('div');
      metaTitle.className='meta-slot-title';
      metaTitle.textContent=ws.metaDone?(ws.metaFname||'Loaded'):'Meta Ads Manager Export';
      var metaDesc=document.createElement('div');
      metaDesc.className='meta-slot-desc';
      metaDesc.textContent=ws.metaDone?(ws.metaFileCount&&ws.metaFileCount>1?ws.metaFileCount+' file Meta berhasil dimuat':'File berhasil dimuat'):'Amount spent · Link clicks · LP Views · Impressions';
      metaBody.appendChild(metaTitle);
      metaBody.appendChild(metaDesc);

      var metaFileInp=document.createElement('input');
      metaFileInp.type='file';
      metaFileInp.multiple=true;
      metaFileInp.accept='.csv,text/csv,text/comma-separated-values,application/csv,application/vnd.ms-excel,text/plain,application/octet-stream,*/*';
      metaFileInp.className='mobile-file-input';
      metaFileInp.addEventListener('change',function(){onMetaFileChange(ws.id,this);});

      var metaBtn=document.createElement('button');
      metaBtn.className='sa-file-btn';
      metaBtn.textContent=ws.metaDone?'✓ Ganti':'Upload CSV';
      metaBtn.addEventListener('click',function(){metaFileInp.click();});
      setupDropZone(metaSlot,function(files){handleMetaFiles(ws.id,files);});

      metaSlot.appendChild(metaIcon);
      metaSlot.appendChild(metaBody);
      metaSlot.appendChild(metaBtn);
      metaSlot.appendChild(metaFileInp);
      body.appendChild(metaSlot);

      var div=document.createElement('hr');
      div.className='ws-divider';
      body.appendChild(div);

      var shopLabel=document.createElement('div');
      shopLabel.className='ws-section-label';
      shopLabel.textContent='Shopee Affiliate CSV — bisa lebih dari 1 akun';
      body.appendChild(shopLabel);

      ws.shopeeAccounts.forEach(function(acc,ai){
        var row=document.createElement('div');
        row.className='shopee-account-row'+(acc.done?' done':'');

        var num=document.createElement('div');
        num.className='sa-num';
        num.textContent=ai+1;

        var inp=document.createElement('input');
        inp.className='sa-label-input';
        inp.type='text';
        inp.placeholder='Nama akun (contoh: Akun Gamis)';
        inp.value=acc.label||'';
        inp.addEventListener('input',function(){acc.label=this.value;});

        var sdiv=document.createElement('div');
        sdiv.className='sa-divider';

        var sFileInp=document.createElement('input');
        sFileInp.type='file';
        sFileInp.accept='.csv,text/csv,text/comma-separated-values,application/csv,application/vnd.ms-excel,text/plain,application/octet-stream,*/*';
        sFileInp.className='mobile-file-input';
        sFileInp.addEventListener('change',function(){onShopeeFileChange(ws.id,acc.id,this);});

        var sBtn=document.createElement('button');
        sBtn.className='sa-file-btn';
        sBtn.textContent=acc.done?'✓ Ganti':'Pilih CSV';
        sBtn.addEventListener('click',function(){sFileInp.click();});
        setupDropZone(row,function(files){handleShopeeFile(ws.id,acc.id,files&&files[0]);});

        var sStatus=document.createElement('span');
        sStatus.className='sa-status';
        sStatus.textContent=acc.done?(acc.fname||'Loaded'):'Belum ada';

        row.appendChild(num);
        row.appendChild(inp);
        row.appendChild(sdiv);
        row.appendChild(sBtn);
        row.appendChild(sFileInp);
        row.appendChild(sStatus);

        if(ws.shopeeAccounts.length>1){
          var rm=document.createElement('button');
          rm.className='sa-remove';
          rm.textContent='×';
          rm.addEventListener('click',function(){removeShopeeFromWorkspace(ws.id,acc.id);});
          row.appendChild(rm);
        }
        body.appendChild(row);
      });

      var addSBtn=document.createElement('button');
      addSBtn.className='btn-add-account';
      addSBtn.innerHTML='<svg viewBox="0 0 24 24" fill="currentColor" style="width:12px;height:12px;"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg> Tambah Akun Shopee';
      addSBtn.addEventListener('click',function(){addShopeeToWorkspace(ws.id);});
      body.appendChild(addSBtn);

      var clickLabel=document.createElement('div');
      clickLabel.className='ws-section-label';
      clickLabel.textContent='SHOPEE CLICK REPORT — OPSIONAL (bisa diupload sore/H+1)';
      body.appendChild(clickLabel);

      var clickSlot=document.createElement('div');
      clickSlot.className='meta-slot'+(ws.clickDone?' done':'');
      var clickIcon=document.createElement('div');
      clickIcon.className='meta-slot-icon';
      clickIcon.innerHTML=ws.clickDone
        ? '<svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none"><path d="M13 5l7 7-7 7M5 12h14" stroke="rgba(238,77,45,.7)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      var clickBody=document.createElement('div');
      clickBody.className='meta-slot-body';
      var clickTitle=document.createElement('div');
      clickTitle.className='meta-slot-title';
      clickTitle.textContent=ws.clickDone?(ws.clickFname||'Loaded'):'WebsiteClickReport Shopee';
      var clickDesc=document.createElement('div');
      clickDesc.className='meta-slot-desc';
      clickDesc.textContent=ws.clickDone?'File klik Shopee berhasil dimuat':'Opsional · Klik ID · Waktu Klik · Tag_link · Perujuk';
      clickBody.appendChild(clickTitle);
      clickBody.appendChild(clickDesc);
      var clickFileInp=document.createElement('input');
      clickFileInp.type='file';
      clickFileInp.accept='.csv,text/csv,text/comma-separated-values,application/csv,application/vnd.ms-excel,text/plain,application/octet-stream,*/*';
      clickFileInp.className='mobile-file-input';
      clickFileInp.addEventListener('change',function(){onShopeeClickFileChange(ws.id,this);});
      var clickBtn=document.createElement('button');
      clickBtn.className='sa-file-btn';
      clickBtn.textContent=ws.clickDone?'✓ Ganti':'Upload Klik';
      clickBtn.addEventListener('click',function(){clickFileInp.click();});
      setupDropZone(clickSlot,function(files){handleShopeeClickFile(ws.id,files&&files[0]);});
      clickSlot.appendChild(clickIcon);
      clickSlot.appendChild(clickBody);
      clickSlot.appendChild(clickBtn);
      clickSlot.appendChild(clickFileInp);
      body.appendChild(clickSlot);

      card.appendChild(body);
    }

    list.appendChild(card);
  });
}

function setupDropZone(el,onFiles){
  if(!el||!onFiles) return;
  ['dragenter','dragover'].forEach(function(evt){
    el.addEventListener(evt,function(e){
      e.preventDefault();
      e.stopPropagation();
      if(e.dataTransfer) e.dataTransfer.dropEffect='copy';
      el.classList.add('drop-active');
    });
  });
  ['dragleave','dragend'].forEach(function(evt){
    el.addEventListener(evt,function(e){
      e.preventDefault();
      e.stopPropagation();
      el.classList.remove('drop-active');
    });
  });
  el.addEventListener('drop',function(e){
    e.preventDefault();
    e.stopPropagation();
    el.classList.remove('drop-active');
    var files=Array.prototype.slice.call((e.dataTransfer&&e.dataTransfer.files)||[]);
    if(files.length) onFiles(files);
  });
}

function handleMetaFiles(wsId, fileList){
  var files=Array.prototype.slice.call(fileList||[]); if(!files.length) return;
  var pending=files.length, raws=new Array(files.length);
  files.forEach(function(f,idx){
    var rd=new FileReader();
    rd.onload=function(ev){
      raws[idx]=ev.target.result;
      pending--;
      if(pending===0){
        var ws=workspaces.find(function(w){return w.id===wsId;});
        if(!ws) return;
        ws.metaRaws=raws;
        ws.metaRaw=raws.join('\n');
        ws.metaDone=true;
        ws.metaFileCount=files.length;
        ws.metaFname=files.length>1?(files.length+' Meta CSV'):(files[0].name.length>34?files[0].name.slice(0,32)+'…':files[0].name);
        renderWorkspaces();
        checkReady();
      }
    };
    rd.readAsText(f,'UTF-8');
  });
}

function onMetaFileChange(wsId, input){
  handleMetaFiles(wsId,input.files);
}

function handleShopeeFile(wsId, akunId, f){
  if(!f) return;
  var rd=new FileReader();
  rd.onload=function(ev){
    var ws=workspaces.find(function(w){return w.id===wsId;});
    if(!ws) return;
    var acc=ws.shopeeAccounts.find(function(a){return a.id===akunId;});
    if(!acc) return;
    acc.raw=ev.target.result;
    acc.done=true;
    acc.fname=f.name.length>22?f.name.slice(0,20)+'…':f.name;
    if(!acc.label) acc.label='Akun '+(ws.shopeeAccounts.indexOf(acc)+1);
    renderWorkspaces();
    checkReady();
  };
  rd.readAsText(f,'UTF-8');
}

function onShopeeFileChange(wsId, akunId, input){
  handleShopeeFile(wsId,akunId,input.files&&input.files[0]);
}

function handleShopeeClickFile(wsId, f){
  if(!f) return;
  var rd=new FileReader();
  rd.onload=function(ev){
    var ws=workspaces.find(function(w){return w.id===wsId;});
    if(!ws) return;
    ws.clickRaw=ev.target.result;
    ws.clickDone=true;
    ws.clickFname=f.name.length>30?f.name.slice(0,28)+'…':f.name;
    renderWorkspaces();
  };
  rd.readAsText(f,'UTF-8');
}

function onShopeeClickFileChange(wsId, input){
  handleShopeeClickFile(wsId,input.files&&input.files[0]);
}
var CAT_COLORS=['#EE4D2D','#22863a','#1d9e75','#d97706','#185fa5','#534ab7','#993c1d','#3b6d11','#72243e','#555'];

var GROUP_META = {
  sosmed:  { label:'Social Media', color:'#38bdf8', activeClass:'active-sosmed',  desc:'Facebook, Instagram, Threads, Website' },
  organic: { label:'Organik',      color:'#22c55e', activeClass:'active-organic', desc:'Shopee Live, Shopee Video, Others' },
};

function getPlatGroup(plat){
  var pl=(plat||'').toLowerCase();
  if(pl.includes('facebook')||pl.includes('instagram')||pl.includes('threads')||pl==='websites'||pl.includes('website')) return 'sosmed';
  return 'organic';
}

function fmt(n){return Math.round(n||0).toLocaleString('id-ID');}
function normalizeTag(s){return String(s||'').toLowerCase().trim().replace(/[-_\s]+$/g,'').replace(/[^a-z0-9]+/g,'');}
function fmtX(n){return Number((n||0).toFixed(2))+'x';}
function fmtROI(spend,comm){if(!spend)return'–';return((comm-spend)/spend*100).toFixed(1)+'%';}
function rcROI(spend,comm){if(!spend)return'color-muted';var r=(comm-spend)/spend*100;return r>=100?'color-gr':r>=0?'color-am':'color-rd';}
function fmtPct(n){return ((n||0)*100).toFixed(1)+'%';}
function fmtK(n){n=n||0;if(n>=1000000)return(n/1000000).toFixed(1)+'jt';if(n>=1000)return Math.round(n/1000)+'rb';return fmt(n);}
function rc(r){return r>=2?'color-gr':r>=1?'color-am':'color-rd';}
function metricHelpText(label){
  var x=String(label||'').toLowerCase();
  if(x.includes('roas')) return 'Return on Ad Spend: komisi dibagi spend iklan. 1x = balik modal, di atas 1x mulai profit.';
  if(x.includes('roi')) return 'Return on Investment: profit bersih dibanding spend. Rumus: (komisi - spend) / spend.';
  if(x.includes('epc')) return 'Earnings per Click: rata-rata komisi per klik. Bandingkan dengan CPC; EPC > CPC lebih sehat.';
  if(x==='net'||x.includes('net profit')) return 'Sisa setelah komisi dikurangi spend iklan. Positif berarti untung, negatif berarti rugi.';
  if(x.includes('real cpc')) return 'Biaya per klik Shopee real: Spend / Shopee Clicks. Kosong jika WebsiteClickReport Shopee belum diupload.';
  if(x.includes('cpc')) return 'CPC Meta: biaya rata-rata untuk 1 klik iklan Meta. Rumus: Spend Meta / Meta Clicks.';
  if(x.includes('cpm')) return 'Biaya per 1.000 tayangan iklan.';
  if(x.includes('ctr')) return 'Click-through rate: persentase orang yang klik setelah melihat iklan.';
  if(x.includes('lp rate')||x.includes('click-to-lp')) return 'Meta-side proxy: persentase klik yang load halaman tujuan menurut Meta, bukan klik real Shopee.';
  if(x.includes('real rate')) return 'Shopee Clicks / Meta Clicks dari WebsiteClickReport Shopee. Ini rate praktis yang lebih real dibanding Meta LP Views.';
  if(x.includes('lp views')) return 'Jumlah landing page view dari Meta: klik yang berhasil memuat halaman tujuan.';
  if(x.includes('pengguna baru')||x.includes('new user')) return 'Jumlah bonus pembeli baru: Status Pemebelian/Pembelian = Baru dan komisi item ≥ Rp50rb. Normal metrics hanya mengeluarkan bonus Rp50rb per item.';
  if(x.includes('rekomendasi')) return 'Saran otomatis: SCALE, TAHAN, atau KILL berdasarkan spend, profit, ROAS/ROI, EPC, dan bonus pengguna baru.';
  if(x.includes('zero komisi')||x.includes('zero%')) return 'Order/item yang masuk tapi komisinya Rp0. Terlalu tinggi bisa bikin profit turun.';
  if(x.includes('avg/order')) return 'Rata-rata komisi per order pada tag/campaign ini.';
  if(x.includes('orders')||x.includes('unique orders')) return 'Jumlah order unik dari Shopee berdasarkan data CSV.';
  if(x.includes('spend')) return 'Biaya iklan Meta. Jika PPN aktif, angka bisa termasuk PPN.';
  if(x.includes('komisi')) return 'Komisi bersih affiliate dari CSV Shopee.';
  if(x.includes('campaign match')||x==='match') return 'Campaign Meta yang dicocokkan otomatis dengan Tag_link1 Shopee.';
  if(x.includes('tag')) return 'Tag_link1 dari link Shopee Affiliate. Idealnya sama/ mirip dengan nama campaign Meta.';
  return '';
}
function helpWrap(label, html){
  var tip=metricHelpText(label);
  var shown=html!==undefined?html:escHtml(label);
  return tip?'<span class="metric-help" tabindex="0" aria-label="'+escHtml(label+': '+tip)+'">'+shown+'<span class="metric-tip">'+escHtml(tip)+'</span></span>':shown;
}
function thHelp(label, html){return'<th>'+helpWrap(label,html)+'</th>';}
function recommendTag(t){
  var hasM=t&&t.matchedCamp&&t.spend>0;
  var clicks=t.clicks||0,orders=t.orderCount||0,net=(t.comm||0)-(t.spend||0),roas=t.roas||0,epc=t.epc||0,cpc=t.cpc||0;
  var spend=t.spend||0;
  var normalComm=t.normalComm!==undefined?t.normalComm:(t.comm||0);
  var normalNet=normalComm-spend;
  var normalRoas=spend?normalComm/spend:0;
  var normalEpc=clicks?normalComm/clicks:0;
  var realRate=t.shopeeClickRate||0;
  var realCpc=t.realCpc||0;
  var newUserCount=t.newUserCount||0;
  var newUserComm=t.newUserComm||0;
  var enoughSpend=spend>=60000;
  var hasClickData=clicks>0;
  var hasRealClick=t.shopeeClicks>0;
  var source=t.commissionSource||{};
  var hasCommissionSource=!!source.hasData;
  var cookieHeavy=hasCommissionSource&&source.previousCookiePct>=0.65;
  var cookieMixed=hasCommissionSource&&source.previousCookiePct>=0.35;
  var reasons=[];
  if(!hasM){
    reasons.push('Campaign Meta belum match dengan Tag_link1, jadi spend/klik belum bisa dipastikan milik tag ini.');
    if(newUserCount>0) reasons.push('Bonus pembeli baru terdeteksi: '+fmt(newUserCount)+' item × Rp50rb.');
    return{label:'TAHAN',cls:'reco-hold',icon:'🟡',title:'Tahan dulu',action:'Jangan scale dulu. Perbaiki nama campaign atau Tag_link1 supaya match, lalu cek ulang setelah data kebaca rapi.',reasons:reasons};
  }
  reasons.push('Spend patokan Bos: Rp 60.000 / 3 hari. Spend saat ini Rp '+fmt(spend));
  if(hasClickData) reasons.push('CPC Meta Rp '+fmt(cpc)+' · EPC normal Rp '+fmt(normalEpc)+' · EPC total Rp '+fmt(epc));
  else reasons.push('Data klik Meta belum kebaca di CSV, jadi keputusan pakai Spend, ROAS, ROI, Net, Orders, dan bonus pengguna baru.');
  if(hasRealClick) reasons.push('Real Rate '+fmtPct(realRate)+' · Real CPC Rp '+fmt(realCpc));
  else reasons.push('Real Rate/Real CPC belum ada karena WebsiteClickReport Shopee belum diupload.');
  if(hasCommissionSource){
    reasons.push('Sumber komisi: '+fmtPct(source.sameDayPct)+' klik hari yang sama, '+fmtPct(source.previousCookiePct)+' cookies sebelumnya.');
    if(cookieMixed) reasons.push((cookieHeavy?'Mayoritas':'Sebagian besar')+' komisi datang dari cookies sebelumnya; hati-hati membaca ROAS hari ini karena bisa ditopang klik hari-hari lalu.');
  } else {
    reasons.push('Sumber komisi belum bisa dipisah karena Waktu Klik di file komisi belum kebaca/lengkap.');
  }
  reasons.push('Total: ROAS '+fmtX(roas)+' · ROI '+fmtROI(spend,t.comm)+' · Net '+(net>=0?'+':'')+'Rp '+fmt(net));
  reasons.push('Normal tanpa bonus pembeli baru: ROAS '+fmtX(normalRoas)+' · ROI '+fmtROI(spend,normalComm)+' · Net '+(normalNet>=0?'+':'')+'Rp '+fmt(normalNet));
  reasons.push('Bonus pembeli baru: '+fmt(newUserCount)+' item × Rp50rb = Rp '+fmt(newUserComm));
  reasons.push('Clicks '+fmt(clicks)+' · Orders '+fmt(orders));
  if(!enoughSpend){
    reasons.unshift('Belum mencapai patokan Rp60rb/3 hari, jadi belum cukup bukti untuk keputusan final.');
    return{label:'TAHAN',cls:'reco-hold',icon:'🟡',title:'Tahan sampai data cukup',action:'Lanjutkan test kecil sampai mendekati Rp60rb atau 3 hari. Jangan scale dulu; cek lagi orders, EPC vs CPC, dan Real Rate sore hari kalau file klik Shopee sudah ada.',reasons:reasons};
  }
  var epcHealthy=!hasClickData||normalEpc>=cpc*1.2;
  var epcRed=hasClickData&&normalEpc<cpc;
  var totalGreen=orders>=1&&net>0&&roas>=1.5;
  var normalGreen=orders>=1&&normalNet>0&&normalRoas>=1.5&&epcHealthy;
  if(totalGreen&&newUserCount>0&&!normalGreen){
    reasons.unshift('Total terlihat hijau, tapi profit normal belum kuat setelah bonus pembeli baru Rp50rb/item dipisahkan.');
    return{label:'TAHAN',cls:'reco-hold',icon:'🟡',title:'Kuning — profit ditopang NEW USER',action:'Jangan scale besar. Tahan budget atau lanjut 1 hari kecil untuk lihat apakah order normal tetap masuk tanpa bergantung bonus NEW USER.',reasons:reasons};
  }
  if(normalGreen&&cookieHeavy){
    reasons.unshift('ROAS normal terlihat hijau, tapi mayoritas komisi berasal dari cookies sebelumnya, bukan klik hari yang sama.');
    return{label:'TAHAN',cls:'reco-hold',icon:'🟡',title:'Kuning — HOLD karena ditopang cookies lama',action:'Jangan scale dulu. Tahan budget/test kecil sampai porsi klik hari yang sama lebih dominan; kalau mayoritas komisi dari cookies lama, performa hari ini belum cukup bersih untuk scale.',reasons:reasons};
  }
  if(normalGreen){
    reasons.unshift('Data tetap hijau setelah bonus pembeli baru dipisahkan: order ada, net normal positif, ROAS normal ≥1.5x, dan EPC normal mengalahkan CPC.');
    return{label:'SCALE',cls:'reco-scale',icon:'🟢',title:'Hijau — kandidat scale',action:'Boleh scale bertahap hanya karena ROAS normal sudah ≥1.5x. Naikkan pelan, jangan agresif, dan pantau 1–2 hari setelah scale.',reasons:reasons};
  }
  if(orders===0||normalRoas<1||normalNet<0||epcRed){
    reasons.unshift('Sudah lewat patokan Rp60rb dan data normal masih merah.');
    return{label:'KILL',cls:'reco-eval',icon:'🔴',title:'Merah — KILL campaign/adset ini',action:'Matikan campaign/adset ini. Jangan tambah budget. Kalau produk masih mau dites, mulai ulang dengan creative/hook/audience/link baru, bukan nerusin yang ini.',reasons:reasons};
  }
  reasons.unshift('Data belum merah fatal, tapi ROAS normal belum mencapai 1.5x, jadi bukan kandidat scale.');
  return{label:'TAHAN',cls:'reco-hold',icon:'🟡',title:'Kuning — HOLD, jangan scale',action:'Jangan scale. Tahan budget/test kecil saja sampai ROAS normal ≥1.5x, EPC normal tetap di atas CPC, dan order normal makin stabil.',reasons:reasons};
}
function recoReasonHtml(x){
  var s=String(x||'');
  if(s.indexOf('Sumber komisi:')===0){
    return '<li class="reco-source-highlight"><b>Sumber komisi</b><span>'+escHtml(s.replace(/^Sumber komisi:\s*/,''))+'</span></li>';
  }
  return '<li>'+escHtml(s)+'</li>';
}
function recoHtml(t){
  var r=recommendTag(t);
  var plain=(r.title+' — Arahan: '+(r.action||'')+' — Alasan: '+r.reasons.join(' | ')).replace(/"/g,'&quot;');
  return'<span class="reco-cell" tabindex="0" aria-label="'+plain+'">'+
    '<span class="reco-badge '+r.cls+'">'+r.icon+' '+r.label+'</span>'+
    '<span class="reco-tip"><div class="reco-tip-title">'+escHtml(r.title)+'</div><div class="reco-tip-action"><div class="reco-tip-label">Arahan</div>'+escHtml(r.action||'Cek data pendukung sebelum ambil aksi.')+'</div><div class="reco-tip-label">Alasan</div><ul>'+r.reasons.map(recoReasonHtml).join('')+'</ul></span>'+
  '</span>';
}
function renderAttributionSummary(tags){
  var rows=tags.map(function(t){return{tag:t.tag,reco:recommendTag(t),spend:t.spend||0,net:(t.normalComm!==undefined?t.normalComm:t.comm||0)-(t.spend||0),orders:t.orderCount||0,hasReal:!!t.shopeeClicks};});
  var scale=rows.filter(function(x){return x.reco.label==='SCALE';});
  var hold=rows.filter(function(x){return x.reco.label==='TAHAN';});
  var kill=rows.filter(function(x){return x.reco.label==='KILL';});
  var noReal=rows.filter(function(x){return !x.hasReal;}).length;
  function topList(arr,n){return arr.sort(function(a,b){return b.spend-a.spend;}).slice(0,n).map(function(x){return escHtml(x.tag)+' (Rp '+fmt(x.spend)+')';}).join(', ');}
  var actions=[];
  if(kill.length) actions.push('<li><b>KILL:</b> matikan '+fmt(kill.length)+' tag/campaign merah. Prioritas stop: '+topList(kill,4)+'. Jangan tambah budget; kalau mau lanjut, mulai ulang dengan creative/hook/link baru.</li>');
  if(scale.length) actions.push('<li><b>SCALE:</b> '+fmt(scale.length)+' tag/campaign hijau boleh dinaikkan bertahap karena ROAS normal sudah ≥1.5x. Pantau 1–2 hari setelah scale karena bisa boncos sementara.</li>');
  if(hold.length) actions.push('<li><b>TAHAN:</b> '+fmt(hold.length)+' tag/campaign jangan discale. ROAS 1.0–1.49x tetap HOLD selama masih profit; tunggu EPC normal, order, dan Real Rate lebih jelas.</li>');
  if(noReal===rows.length) actions.push('<li><b>Real Rate belum ada:</b> kalau ini cek pagi, tidak masalah. Sore upload ulang dengan WebsiteClickReport Shopee supaya Real CPC/Real Rate kebaca.</li>');
  else if(noReal>0) actions.push('<li><b>Real Rate sebagian kosong:</b> '+fmt(noReal)+' baris belum punya klik Shopee. Keputusan baris itu masih pakai proxy Meta + komisi.</li>');
  if(!actions.length) actions.push('<li>Belum ada arahan khusus. Cek apakah Tag_link1 dan campaign Meta sudah match.</li>');
  return '<div class="attr-summary">'+
    '<div class="attr-summary-title">Rangkuman Aksi Berdasarkan Data di Atas</div>'+
    '<div class="attr-summary-sub">Ringkasan ini mengikuti rekomendasi per tag/campaign yang sedang tampil setelah filter tanggal/akun/platform.</div>'+
    '<div class="attr-summary-grid">'+
      '<div class="attr-summary-box"><strong class="color-gr">'+fmt(scale.length)+'</strong><span>SCALE — hanya ≥1.5x</span></div>'+
      '<div class="attr-summary-box"><strong class="color-am">'+fmt(hold.length)+'</strong><span>HOLD — 1.0–1.49x jangan scale</span></div>'+
      '<div class="attr-summary-box"><strong class="color-rd">'+fmt(kill.length)+'</strong><span>KILL — stop spend</span></div>'+
    '</div><ul class="attr-action-list">'+actions.join('')+'</ul></div>';
}

function checkReady(){
  var ok=workspaces.some(function(w){return isWorkspaceReady(w);});
  document.getElementById('btn-go').disabled=!ok;
}

(function(){addWorkspace();})();

// PARSERS
function parseMeta(txt){
  var r=Papa.parse(txt.trim(),{header:true,skipEmptyLines:true});
  function col(row){
    var keys=Array.prototype.slice.call(arguments,1);
    for(var i=0;i<keys.length;i++){if(row[keys[i]]!==undefined&&row[keys[i]]!=='')return row[keys[i]];}
    return '';
  }
  function num(v){
    v=String(v===undefined||v===null?'':v).trim();
    if(!v) return 0;
    v=v.replace(/Rp\s*/gi,'').replace(/%/g,'').replace(/\s/g,'');
    if(v.indexOf(',')>=0&&v.indexOf('.')>=0) v=v.replace(/,/g,'');
    else if(v.indexOf(',')>=0) v=v.replace(/,/g,'.');
    return parseFloat(v)||0;
  }
  function isoDate(v){
    v=String(v||'').trim();
    if(!v) return '';
    if(/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    var d=new Date(v);
    if(isNaN(d)) return v.slice(0,10);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function daysBetween(start,end){
    start=isoDate(start); end=isoDate(end||start);
    var s=new Date(start+'T00:00:00'), e=new Date(end+'T00:00:00');
    if(!start||!end||isNaN(s)||isNaN(e)||e<s) return 1;
    return Math.round((e-s)/(24*60*60*1000))+1;
  }
  var headers=r.meta&&r.meta.fields?r.meta.fields:[];
  var isID=headers.some(function(h){
    return['Jumlah yang dibelanjakan (IDR)','Klik tautan','Klik Tautan','Tayangan','Impresi',
           'Nama kampanye','Nama Kampanye','Nama set iklan','Nama Set Iklan','Awal pelaporan','Laporan mulai'].indexOf(h)>=0;
  });
  return r.data.filter(function(row){
    var spendVal=col(row,'Amount spent (IDR)','Jumlah yang dibelanjakan (IDR)');
    return num(spendVal)>0;
  }).map(function(row){
    var spend=num(col(row,'Amount spent (IDR)','Jumlah yang dibelanjakan (IDR)'));
    var clicks=num(col(row,'Link clicks','Unique link clicks','Clicks','Clicks (all)','Outbound clicks','Unique outbound clicks','Klik tautan','Klik Tautan','Klik tautan unik','Klik Tautan Unik','Klik','Klik (semua)','Klik keluar','Klik keluar unik'));
    var resultIndicator=String(col(row,'Result indicator','Results indicator','Indikator hasil','Indikator Hasil')||'').toLowerCase();
    if(!clicks&&resultIndicator.indexOf('link_click')>=0) clicks=num(col(row,'Results','Hasil'));
    var lp=num(col(row,'Landing page views','Tampilan halaman landing','Tayangan Halaman Landas','Tayangan halaman tujuan'));
    var impr=num(col(row,'Impressions','Tayangan','Impresi'));
    var cpc=num(col(row,'CPC (cost per link click) (IDR)','CPC (cost per click) (IDR)','CPC (all) (IDR)','Cost per outbound click (IDR)','Cost per unique outbound click (IDR)','Cost per results','Cost per result','Biaya per hasil','Biaya per Hasil','BPK (biaya per klik tautan) (IDR)','CPC (Biaya per Klik Tautan) (IDR)','CPC (biaya per klik tautan) (IDR)','Biaya per klik keluar unik (IDR)'))||(clicks?spend/clicks:0);
    if(!clicks&&cpc&&spend) clicks=spend/cpc;
    var cpm=num(col(row,'CPM (cost per 1,000 impressions) (IDR)','BPS (biaya per 1.000 tayangan) (IDR)','CPM (Biaya Per 1.000 Tayangan) (IDR)'))||(impr?spend/impr*1000:0);
    var ctr=num(col(row,'CTR (link click-through rate)','CTR (all)','Outbound CTR (click-through rate)','Unique outbound CTR (click-through rate)','RKT (rasio klik-tayang tautan)','CTR Unik (Rasio Klik Tayang Tautan)'));
    if(ctr>1) ctr=ctr/100;
    var start=isoDate(col(row,'Reporting starts','Laporan mulai','Awal pelaporan').trim());
    var end=isoDate(col(row,'Reporting ends','Laporan berakhir','Akhir pelaporan').trim()||start);
    var campaign=col(row,'Campaign name','Campaign Name','Ad set name','Ad Set Name','Nama kampanye','Nama Kampanye','Nama set iklan','Nama Set Iklan').trim();
    return{date:start,campaign:campaign,spend:spend,clicks:clicks,lp:lp,impressions:impr,ctr:ctr,cpc:cpc,cpm:cpm,lang:isID?'id':'en',rangeStart:start,rangeEnd:end,rangeDays:daysBetween(start,end)};
  });
}
function parseShopee(txt, akunLabel, akunId){
  var clean=txt.replace(/^\uFEFF/,'');
  var r=Papa.parse(clean,{header:true,skipEmptyLines:true});
  var fields=r.meta&&r.meta.fields?r.meta.fields:[];

  var isEN=fields.indexOf('Order Status')>=0||fields.indexOf('Order id')>=0||fields.indexOf('Order ID')>=0;
  var isNewEN=fields.indexOf('Affiliate Net Commission(Rp)')>=0;
  var isOldEN=fields.indexOf('Affiliate Net Commission (Rp)')>=0;

  function col(row){
    for(var i=1;i<arguments.length;i++){
      var v=row[arguments[i]];
      if(v!==undefined&&v!==null&&v!=='') return v;
    }
    return '';
  }

  var invalidStatuses=isEN?{'Cancelled':1,'Unpaid':1}:{'Dibatalkan':1,'Belum Dibayar':1};

  return r.data.filter(function(row){
    var st=col(row,'Order Status','Status Pesanan').trim();
    var affSt=col(row,'Affiliate Product Status','Status Produk Affiliate').trim();
    return st!==''&&!invalidStatuses[st]&&!invalidStatuses[affSt];
  }).map(function(row){
    var commStr=col(row,
      'Affiliate Net Commission(Rp)',
      'Affiliate Net Commission (Rp)',
      'Komisi Bersih Affiliate (Rp)'
    );
    var comm=parseFloat((commStr||'0').replace(/,/g,'.'))||0;

    var purchStr=col(row,
      'Purchase Value(Rp)',
      'Purchase Value (Rp)',
      'Nilai Pembelian(Rp)',
      'Nilai Pembelian (Rp)'
    );
    var purchase=parseFloat((purchStr||'0').replace(/,/g,'.'))||0;

    var platRaw=col(row,'Channel','Platform').replace(/["\r\n]/g,'').trim()||'Others';
    var purchaseStatus=col(row,
      'Status Pemebelian',
      'Status Pembelian',
      'Purchase Status',
      'Buyer Status'
    ).replace(/["\r\n]/g,'').trim();
    var purchaseStatusNorm=purchaseStatus.toLowerCase();
    var isNewBuyer=purchaseStatusNorm==='baru'||purchaseStatusNorm==='new'||purchaseStatusNorm==='new buyer'||purchaseStatusNorm==='new user';
    var isNewUser=isNewBuyer&&comm>=50000;

    return{
      orderId:col(row,'Order id','Order ID','ID Pemesanan'),
      status:col(row,'Order Status','Status Pesanan').trim(),
      clickDate:col(row,'Click Time','Waktu Klik').trim().slice(0,10),
      orderDate:col(row,'Order Time','Waktu Pemesanan').trim().slice(0,10),
      filterDate:col(row,'Order Time','Waktu Pemesanan').trim().slice(0,10),
      product:col(row,'Item Name','Nama Barange').trim(),
      cat1:col(row,'L1 Global Category','L1 Kategori Global').trim(),
      purchase:purchase,
      comm:comm,
      platform:platRaw,
      purchaseStatus:purchaseStatus,
      isNewBuyer:isNewBuyer,
      isNewUser:isNewUser,
      tag1:(row['Tag_link1']||'').trim(),
      akunId:akunId,
      akunLabel:akunLabel||('Akun '+akunId),
      lang:isEN?'en':'id',
    };
  });
}

function parseShopeeClicks(txt){
  var clean=txt.replace(/^\uFEFF/,'');
  var r=Papa.parse(clean,{header:true,skipEmptyLines:true});
  function col(row){
    for(var i=1;i<arguments.length;i++){
      var v=row[arguments[i]];
      if(v!==undefined&&v!==null&&v!=='') return v;
    }
    return '';
  }
  return r.data.map(function(row){
    var dt=col(row,'Waktu Klik','Click Time').trim();
    var tag=col(row,'Tag_link','Tag_link1','Tag').trim();
    var ref=col(row,'Perujuk','Referrer','Referer').trim()||'Others';
    return{
      clickId:col(row,'Klik ID','Click ID').trim(),
      date:dt.slice(0,10),
      clickTime:dt,
      region:col(row,'Wilayah Klik','Click Region').trim(),
      tag:tag,
      tagNorm:normalizeTag(tag),
      referrer:ref,
      platform:ref
    };
  }).filter(function(r){return r.clickId&&r.tagNorm&&r.date;});
}

function runAnalysis(){
  try{
    var wsCount=workspaces.filter(function(w){return isWorkspaceReady(w);}).length;
    var akunCount=workspaces.reduce(function(a,w){return a+w.shopeeAccounts.filter(function(s){return s.done;}).length;},0);
    if(typeof gtag!=='undefined') gtag('event','analysis_started',{workspace_count:wsCount,akun_count:akunCount});
    if(typeof fbq!=='undefined') fbq('trackCustom','AnalysisStarted',{workspace_count:wsCount,akun_count:akunCount});
  }catch(e){}
  metaData=[];
  shopeeData=[];
  shopeeClickData=[];
  shopeeAccounts=[];

  workspaces.forEach(function(ws){
    if(!ws.metaDone) return;
    var metaRaws=(ws.metaRaws&&ws.metaRaws.length)?ws.metaRaws:[ws.metaRaw];
    metaRaws.forEach(function(raw,rawIdx){
      var mRows=parseMeta(raw||'');
      mRows.forEach(function(r){r.wsId=ws.id;r.wsName=ws.name||('Workspace '+ws.id);r.metaFileIndex=rawIdx+1;});
      metaData=metaData.concat(mRows);
    });

    if(ws.clickDone&&ws.clickRaw){
      var cRows=parseShopeeClicks(ws.clickRaw);
      cRows.forEach(function(r){r.wsId=ws.id;r.wsName=ws.name||('Workspace '+ws.id);});
      shopeeClickData=shopeeClickData.concat(cRows);
    }

    ws.shopeeAccounts.filter(function(a){return a.done;}).forEach(function(acc){
      var label=acc.label||('Akun '+acc.id);
      var sRows=parseShopee(acc.raw, label, acc.id);
      sRows.forEach(function(r){r.wsId=ws.id;r.wsName=ws.name||('Workspace '+ws.id);});
      shopeeData=shopeeData.concat(sRows);
      acc.wsId=ws.id;
      acc.wsName=ws.name||('Workspace '+ws.id);
      shopeeAccounts.push(acc);
    });
  });

  var metaDates=metaData.reduce(function(a,r){if(r.rangeStart)a.push(r.rangeStart);else if(r.date)a.push(r.date);if(r.rangeEnd&&r.rangeEnd!==r.rangeStart)a.push(r.rangeEnd);return a;},[]).filter(Boolean).sort();
  var shopeeDates=shopeeData.map(function(r){return r.filterDate;}).filter(Boolean).sort();
  rawMinMeta=metaDates[0]||''; rawMaxMeta=metaDates[metaDates.length-1]||'';
  rawMinShopee=shopeeDates[0]||''; rawMaxShopee=shopeeDates[shopeeDates.length-1]||'';
  var allDates=metaDates.concat(shopeeDates).sort();
  rawMin=allDates[0]||''; rawMax=allDates[allDates.length-1]||'';
  document.getElementById('d-start').value=rawMin;
  document.getElementById('d-end').value=rawMax;
  document.getElementById('up-screen').style.display='none';
  document.getElementById('dash-screen').style.display='block';
  window._metaLang=metaData.length&&metaData[0].lang?metaData[0].lang:'en';

  activePlatforms=new Set();
  activeAkuns=new Set();
  activeWorkspaces=new Set();
  var allPlats={};
  shopeeData.forEach(function(r){
    var p=r.platform||'Others'; allPlats[p]=1;
    activeAkuns.add(r.akunId);
    activeWorkspaces.add(r.wsId);
  });
  metaData.forEach(function(r){activeWorkspaces.add(r.wsId);});
  Object.keys(allPlats).forEach(function(p){activePlatforms.add(p);});

  setTimeout(function(){
    var bs=document.getElementById('btn-semua'),bt=document.getElementById('btn-terbaru');
    if(bs){bs.classList.add('og');}
    if(bt){bt.classList.remove('og');}
  },0);
  rerender();
  setTimeout(function(){ autoSaveCurrentSnapshot(); }, 250);
}
function backToUpload(){
  document.getElementById('dash-screen').style.display='none';
  var up=document.getElementById('up-screen');
  up.style.display='flex';
  document.body.scrollTop=0;
  document.documentElement.scrollTop=0;
  workspaces.forEach(function(w){w.collapsed=false;});
  renderWorkspaces();
  checkReady();
  loadHistoryList(false);
}
function resetDates(){
  document.getElementById('d-start').value=rawMin;
  document.getElementById('d-end').value=rawMax;
  document.getElementById('btn-semua').classList.add('og');
  document.getElementById('btn-terbaru').classList.remove('og');
  rerender();
}
function setLastDate(){
  document.getElementById('d-start').value=rawMax;
  document.getElementById('d-end').value=rawMax;
  document.getElementById('btn-terbaru').classList.add('og');
  document.getElementById('btn-semua').classList.remove('og');
  rerender();
}
function getPPN(){return parseFloat(document.getElementById('ppn-rate').value||0);}
function getSpendWithPPN(spend){return spend*(1+getPPN());}
function fmtPPN(){var r=getPPN();return r>0?(r*100).toFixed(0)+'%':'';}
function getFiltered(){
  var s=document.getElementById('d-start').value,e=document.getElementById('d-end').value;
  function metaOverlapsFilter(r){
    var rs=r.rangeStart||r.date||'';
    var re=r.rangeEnd||r.date||rs;
    if(s&&re<s) return false;
    if(e&&rs>e) return false;
    return true;
  }
  return{
    meta:metaData.filter(function(r){
      return metaOverlapsFilter(r)&&(activeWorkspaces.size===0||activeWorkspaces.has(r.wsId));
    }),
    shopee:shopeeData.filter(function(r){
      var p=r.platform||'Others';
      return(!s||r.filterDate>=s)&&(!e||r.filterDate<=e)&&activePlatforms.has(p)&&(activeAkuns.size===0||activeAkuns.has(r.akunId))&&(activeWorkspaces.size===0||activeWorkspaces.has(r.wsId));
    }),
    shopeeClicks:shopeeClickData.filter(function(r){
      var p=r.platform||'Others';
      return(!s||r.date>=s)&&(!e||r.date<=e)&&activePlatforms.has(p)&&(activeWorkspaces.size===0||activeWorkspaces.has(r.wsId));
    }),
    s:s,e:e
  };
}

// ─── TRAFFIC FILTER RENDER ───
function getAllPlatforms(){
  var plats={};
  shopeeData.forEach(function(r){var p=r.platform||'Others';plats[p]=(plats[p]||0)+1;});
  return plats;
}

function getActiveGroups(){
  var allPlats=getAllPlatforms();
  var groups={sosmed:true,organic:true};
  var groupHas={sosmed:false,organic:false};
  Object.keys(allPlats).forEach(function(p){groupHas[getPlatGroup(p)]=true;});
  Object.keys(groups).forEach(function(g){
    var platsinGroup=Object.keys(allPlats).filter(function(p){return getPlatGroup(p)===g;});
    if(platsinGroup.length===0){groups[g]=false;return;}
    groups[g]=platsinGroup.every(function(p){return activePlatforms.has(p);});
  });
  return{groups:groups,present:groupHas};
}

function renderTrafficFilters(){
  var allPlats=getAllPlatforms();
  var totalItems=shopeeData.length;
  var activeItems=shopeeData.filter(function(r){return activePlatforms.has(r.platform||'Others');}).length;
  var gState=getActiveGroups();

  var sumEl=document.getElementById('traffic-summary');
  if(sumEl){
    var pct=totalItems?Math.round(activeItems/totalItems*100):0;
    sumEl.innerHTML='<strong>'+fmt(activeItems)+'</strong> / '+fmt(totalItems)+' orders ('+pct+'%)';
  }

  var groupEl=document.getElementById('traffic-groups');
  if(!groupEl) return;
  var groupOrder=['sosmed','organic'];
  var gHtml='';
  gHtml+='<button onclick="selectAllTraffic()" class="group-btn'+(activePlatforms.size===Object.keys(allPlats).length?' active-all':'')+'" style="font-size:11px;"><span class="dot" style="background:var(--og);"></span>Semua</button>';
  gHtml+='<div class="traffic-divider"></div>';
  groupOrder.forEach(function(g){
    var meta=GROUP_META[g];
    if(!gState.present[g]) return;
    var isActive=gState.groups[g];
    var platsinGroup=Object.keys(allPlats).filter(function(p){return getPlatGroup(p)===g;});
    var cnt=platsinGroup.reduce(function(a,p){return a+(allPlats[p]||0);},0);
    gHtml+='<button onclick="toggleGroup(\''+g+'\')" class="group-btn'+(isActive?' '+meta.activeClass:'')+'" title="'+meta.desc+'">'+
      '<span class="dot" style="background:'+(isActive?meta.color:'var(--text3)');+'"></span>'+meta.label+
      ' <span style="opacity:.55;font-size:10px;">'+cnt+'</span></button>';
  });
  groupEl.innerHTML=gHtml;

  var chipEl=document.getElementById('plat-chips');
  if(!chipEl) return;
  var platOrder=['Facebook','Instagram','Threads','Websites','Shopeevideo-Shopee','Shopeelive-Shopee','Others'];
  var platLabels={'Facebook':'Facebook','Instagram':'Instagram','Threads':'Threads','Websites':'Website','Shopeevideo-Shopee':'Shopee Video','Shopeelive-Shopee':'Shopee Live','Others':'Others'};
  var sortedPlats=Object.keys(allPlats).sort(function(a,b){
    var ia=platOrder.indexOf(a),ib=platOrder.indexOf(b);
    if(ia<0)ia=99;if(ib<0)ib=99;return ia-ib;
  });
  var chipHtml='<span style="font-size:10px;color:var(--text3);align-self:center;white-space:nowrap;padding-right:2px;">Per platform:</span>';
  sortedPlats.forEach(function(p){
    var on=activePlatforms.has(p);
    var label=platLabels[p]||p;
    var cnt=allPlats[p]||0;
    var grp=getPlatGroup(p);
    chipHtml+='<button onclick="togglePlat(\''+p+'\')" class="plat-chip'+(on?' on':'')+'" data-group="'+grp+'" title="'+p+'">'+
      '<span class="chip-dot"></span>'+label+' <span style="opacity:.5;">'+cnt+'</span></button>';
  });
  chipEl.innerHTML=chipHtml;

  var akunWrap=document.getElementById('akun-filter-wrap');
  if(!akunWrap) return;
  var doneAkuns=shopeeAccounts.filter(function(a){return a.done;});
  renderQuickAkunSelect(doneAkuns);
  if(doneAkuns.length<=1){akunWrap.style.display='none';return;}
  akunWrap.style.display='flex';
  var akunHtml='<span class="akun-filter-label">Akun:</span>';
  var allAkunOn=doneAkuns.every(function(a){return activeAkuns.has(a.id);});
  akunHtml+='<button onclick="selectAllAkuns()" class="akun-pill'+(allAkunOn?' on':'')+'" style="font-weight:500;">Semua Akun</button>';
  doneAkuns.forEach(function(acc){
    var on=activeAkuns.has(acc.id);
    var cnt=shopeeData.filter(function(r){return r.akunId===acc.id;}).length;
    akunHtml+='<button onclick="toggleAkun('+acc.id+')" class="akun-pill'+(on?' on':'')+'" title="'+escHtml(acc.label)+'">'+
      escHtml(acc.label)+' <span style="opacity:.5;font-size:10px;">'+cnt+'</span></button>';
  });
  akunWrap.innerHTML=akunHtml;

  var wsWrap=document.getElementById('ws-filter-wrap');
  if(!wsWrap) return;
  var readyWs=workspaces.filter(function(w){return isWorkspaceReady(w);});
  if(readyWs.length<=1){wsWrap.style.display='none';}
  else{
    wsWrap.style.display='flex';
    var wsHtml='<span class="akun-filter-label">Workspace:</span>';
    var allWsOn=readyWs.every(function(w){return activeWorkspaces.has(w.id);});
    wsHtml+='<button onclick="selectAllWorkspaces()" class="akun-pill'+(allWsOn?' on':'')+'" style="font-weight:500;">Semua</button>';
    readyWs.forEach(function(ws){
      var on=activeWorkspaces.has(ws.id);
      var mCount=metaData.filter(function(r){return r.wsId===ws.id;}).length;
      var sCount=shopeeData.filter(function(r){return r.wsId===ws.id;}).length;
      wsHtml+='<button onclick="toggleWorkspaceFilter('+ws.id+')" class="akun-pill'+(on?' on':'')+'" style="'+(on?'border-color:rgba(99,179,237,.45);color:#90cdf4;background:rgba(99,179,237,.08);':'')+'" title="Meta: '+mCount+' rows · Shopee: '+sCount+' rows">'+
        escHtml(ws.name||('Workspace '+ws.id))+
      '</button>';
    });
    wsWrap.innerHTML=wsHtml;
  }
}

function accountWorkspaceIds(accId){
  var ids={};
  shopeeAccounts.filter(function(a){return a.done&&a.id===accId;}).forEach(function(a){if(a.wsId)ids[a.wsId]=1;});
  shopeeData.filter(function(r){return r.akunId===accId;}).forEach(function(r){if(r.wsId)ids[r.wsId]=1;});
  return Object.keys(ids).map(function(x){return parseInt(x,10);}).filter(Boolean);
}

function renderQuickAkunSelect(doneAkuns){
  doneAkuns=doneAkuns||shopeeAccounts.filter(function(a){return a.done;});
  var wrap=document.getElementById('quick-akun-control');
  var sel=document.getElementById('quick-akun-select');
  if(!wrap||!sel) return;
  if(doneAkuns.length<=1){wrap.style.display='none';return;}
  wrap.style.display='flex';
  var allAkunOn=doneAkuns.every(function(a){return activeAkuns.has(a.id);});
  var readyWs=workspaces.filter(function(w){return isWorkspaceReady(w);});
  var allWsOn=readyWs.every(function(w){return activeWorkspaces.has(w.id);});
  var selected='__custom__';
  if(allAkunOn&&allWsOn) selected='__all__';
  else if(activeAkuns.size===1){
    var onlyAkun=Array.from(activeAkuns)[0];
    var wsIds=accountWorkspaceIds(onlyAkun);
    var wsMatch=wsIds.length>0&&activeWorkspaces.size===wsIds.length&&wsIds.every(function(id){return activeWorkspaces.has(id);});
    if(wsMatch) selected=String(onlyAkun);
  }
  var html='<option value="__all__">Gabungan semua</option>';
  if(selected==='__custom__') html+='<option value="__custom__">Custom filter</option>';
  doneAkuns.forEach(function(acc){
    var wsIds=accountWorkspaceIds(acc.id);
    var wsObj=wsIds.length?workspaces.find(function(w){return w.id===wsIds[0];}):null;
    var wsName=acc.wsName||(wsObj&&(wsObj.name||('Workspace '+wsObj.id)))||'';
    var label=acc.label||('Akun '+acc.id);
    html+='<option value="'+acc.id+'">'+escHtml(label+(wsName?' · '+wsName:''))+'</option>';
  });
  sel.innerHTML=html;
  sel.value=selected;
}

function changeQuickAkun(value){
  var doneAkuns=shopeeAccounts.filter(function(a){return a.done;});
  var readyWs=workspaces.filter(function(w){return isWorkspaceReady(w);});
  if(value==='__custom__') return;
  activeAkuns=new Set();
  activeWorkspaces=new Set();
  if(value==='__all__'){
    doneAkuns.forEach(function(a){activeAkuns.add(a.id);});
    readyWs.forEach(function(w){activeWorkspaces.add(w.id);});
  }else{
    var id=parseInt(value,10);
    if(id) activeAkuns.add(id);
    accountWorkspaceIds(id).forEach(function(wsId){activeWorkspaces.add(wsId);});
  }
  rerender();
}

function toggleWorkspaceFilter(wsId){
  if(activeWorkspaces.has(wsId)){
    if(activeWorkspaces.size===1) return;
    activeWorkspaces.delete(wsId);
  } else {
    activeWorkspaces.add(wsId);
  }
  rerender();
}

function selectAllWorkspaces(){
  workspaces.forEach(function(w){activeWorkspaces.add(w.id);});
  rerender();
}

function toggleAkun(id){
  if(activeAkuns.has(id)){
    if(activeAkuns.size===1) return;
    activeAkuns.delete(id);
  } else {
    activeAkuns.add(id);
  }
  rerender();
}

function selectAllAkuns(){
  shopeeAccounts.filter(function(a){return a.done;}).forEach(function(a){activeAkuns.add(a.id);});
  rerender();
}

function toggleGroup(g){
  var allPlats=getAllPlatforms();
  var platsinGroup=Object.keys(allPlats).filter(function(p){return getPlatGroup(p)===g;});
  var allOn=platsinGroup.every(function(p){return activePlatforms.has(p);});
  if(allOn){
    var wouldRemain=Array.from(activePlatforms).filter(function(p){return getPlatGroup(p)!==g;});
    if(wouldRemain.length===0) return;
    platsinGroup.forEach(function(p){activePlatforms.delete(p);});
  } else {
    platsinGroup.forEach(function(p){activePlatforms.add(p);});
  }
  rerender();
}

function selectAllTraffic(){
  var allPlats=getAllPlatforms();
  Object.keys(allPlats).forEach(function(p){activePlatforms.add(p);});
  rerender();
}

function togglePlat(p){
  if(activePlatforms.has(p)){
    if(activePlatforms.size===1) return;
    activePlatforms.delete(p);
  } else {
    activePlatforms.add(p);
  }
  rerender();
}

// AGGREGATIONS
function aggDate(meta,shopee){
  var m={},sv={};
  meta.forEach(function(r){
    if((r.rangeDays||1)>1) return;
    if(!m[r.date])m[r.date]={spend:0,clicks:0,lp:0,impressions:0};
    m[r.date].spend+=r.spend;m[r.date].clicks+=r.clicks;m[r.date].lp+=r.lp;m[r.date].impressions+=r.impressions;
  });
  shopee.forEach(function(r){var d=r.filterDate;if(!d)return;if(!sv[d])sv[d]={comm:0,items:0,ids:{},zero:0};sv[d].comm+=r.comm;sv[d].items++;sv[d].ids[r.orderId]=1;if(r.comm===0)sv[d].zero++;});
  var allD=[].concat(Object.keys(m),Object.keys(sv)).filter(function(v,i,a){return a.indexOf(v)===i;}).sort();
  return{m:m,sv:sv,allD:allD};
}
function aggCamp(meta){
  var c={};
  meta.forEach(function(r){var k=r.campaign;if(!c[k])c[k]={campaign:k,spend:0,clicks:0,lp:0,impressions:0,days:0};c[k].spend+=r.spend;c[k].clicks+=r.clicks;c[k].lp+=r.lp;c[k].impressions+=r.impressions;c[k].days++;});
  return Object.values(c).sort(function(a,b){return b.spend-a.spend;});
}
function aggCat(shopee){
  var c={};shopee.forEach(function(r){var k=r.cat1||'Lainnya';if(!c[k])c[k]={cat:k,comm:0,items:0};c[k].comm+=r.comm;c[k].items++;});
  return Object.values(c).sort(function(a,b){return b.comm-a.comm;});
}
function aggProd(shopee){
  var p={};shopee.forEach(function(r){var k=(r.product||'').slice(0,55);if(!p[k])p[k]={product:k,cat:r.cat1,comm:0,items:0};p[k].comm+=r.comm;p[k].items++;});
  return Object.values(p).sort(function(a,b){return b.comm-a.comm;}).slice(0,15);
}
function aggPlat(shopee){
  var p={};shopee.forEach(function(r){var k=r.platform||'Others';if(!p[k])p[k]={platform:k,comm:0,items:0};p[k].comm+=r.comm;p[k].items++;});
  return Object.values(p).sort(function(a,b){return b.comm-a.comm;});
}
function isNewUserBonusRow(r){
  var s=String(r.purchaseStatus||'').trim().toLowerCase();
  return (s==='baru'||s==='new'||s==='new buyer'||s==='new user')&&Number(r.comm||0)>=50000;
}
function buildCommissionSourceStats(rows){
  rows=rows||[];
  var total=0,same=0,prev=0,unknown=0,sameOrders={},prevOrders={},unknownOrders={};
  rows.forEach(function(r){
    var comm=Number(r&&r.comm||0);
    if(comm<=0) return;
    total+=comm;
    var clickDate=String(r.clickDate||'').slice(0,10);
    var orderDate=String(r.filterDate||r.orderDate||'').slice(0,10);
    var oid=r.orderId||'';
    if(!clickDate||!orderDate){unknown+=comm;if(oid)unknownOrders[oid]=1;return;}
    if(clickDate===orderDate){same+=comm;if(oid)sameOrders[oid]=1;}
    else if(clickDate<orderDate){prev+=comm;if(oid)prevOrders[oid]=1;}
    else {unknown+=comm;if(oid)unknownOrders[oid]=1;}
  });
  return{
    totalComm:total,
    sameDayComm:same,
    previousCookieComm:prev,
    unknownComm:unknown,
    sameDayPct:total?same/total:0,
    previousCookiePct:total?prev/total:0,
    unknownPct:total?unknown/total:0,
    sameDayOrders:Object.keys(sameOrders).length,
    previousCookieOrders:Object.keys(prevOrders).length,
    unknownOrders:Object.keys(unknownOrders).length,
    hasData:total>0&&(same+prev)>0
  };
}

function aggTag(shopee,meta,shopeeClicks){
  shopeeClicks=shopeeClicks||[];
  var t={};
  function ensureTag(k){if(!t[k])t[k]={tag:k,comm:0,items:0,ids:{},gmv:0,akunIds:{},akunLabel:'',newUserCount:0,newUserComm:0,shopeeClicks:0,sourceRows:[]};return t[k];}
  shopee.forEach(function(r){var k=r.tag1||'(no tag)';var o=ensureTag(k);o.comm+=r.comm;o.items++;o.ids[r.orderId]=1;o.gmv+=r.purchase;o.akunIds[r.akunId]=r.akunLabel||('Akun '+r.akunId);o.sourceRows.push(r);if(isNewUserBonusRow(r)){o.newUserCount++;o.newUserComm+=50000;}});
  shopeeClicks.forEach(function(r){var k=(r.tag||'').replace(/[-_\s]+$/g,'')||'(no tag)';var o=ensureTag(k);o.shopeeClicks+=Number(r.count||1);});
  var clickByNorm={};
  shopeeClicks.forEach(function(r){clickByNorm[r.tagNorm]=(clickByNorm[r.tagNorm]||0)+Number(r.count||1);});
  Object.keys(t).forEach(function(k){var n=normalizeTag(k);if(clickByNorm[n])t[k].shopeeClicks=clickByNorm[n];});
  var campSpend={},campClicks={};meta.forEach(function(r){campSpend[r.campaign]=(campSpend[r.campaign]||0)+r.spend*(1+getPPN());campClicks[r.campaign]=(campClicks[r.campaign]||0)+r.clicks;});
  return Object.values(t).sort(function(a,b){return b.comm-a.comm;}).map(function(tag){
    var best=null,bestScore=0;
    Object.keys(campSpend).forEach(function(c){
      var tl=tag.tag.toLowerCase().replace(/[\s\-_]/g,'');
      var cl=c.toLowerCase();
      var sc=0;
      if(tag.tag.toLowerCase()===cl) sc=100;
      else if(tag.tag.toLowerCase().includes(cl)||cl.includes(tag.tag.toLowerCase())) sc=80;
      else {
        var campWords=cl.split(/[\s\-_]/).filter(function(w){return w.replace(/\d+$/,'').length>=4;});
        var matches=0;
        campWords.forEach(function(w){var wc=w.replace(/\d+$/,'');if(wc.length>=4&&tl.indexOf(wc)>=0) matches++;});
        if(matches>0) sc=Math.round(matches/campWords.length*70)+matches*8;
      }
      if(sc>bestScore){bestScore=sc;best=c;}
    });
    tag.matchedCamp=best;tag.spend=best?campSpend[best]:0;tag.clicks=best?campClicks[best]:0;tag.normalComm=Math.max(0,tag.comm-(tag.newUserComm||0));tag.roas=tag.spend?tag.comm/tag.spend:0;tag.normalRoas=tag.spend?tag.normalComm/tag.spend:0;tag.epc=tag.clicks?tag.comm/tag.clicks:0;tag.normalEpc=tag.clicks?tag.normalComm/tag.clicks:0;tag.cpc=tag.clicks?tag.spend/tag.clicks:0;tag.shopeeClickRate=tag.clicks?tag.shopeeClicks/tag.clicks:0;tag.realCpc=tag.shopeeClicks?tag.spend/tag.shopeeClicks:0;tag.clickLoss=tag.clicks?Math.max(0,1-tag.shopeeClickRate):0;tag.orderCount=Object.keys(tag.ids).length;tag.commissionSource=buildCommissionSourceStats(tag.sourceRows||[]);
    tag.akunLabel=Object.values(tag.akunIds||{}).join(', ');
    return tag;
  });
}

function campaignMatchesTag(campaign,tag){
  var c=normalizeTag(campaign||''),t=normalizeTag(tag||'');
  if(!c||!t) return false;
  return c===t||c.indexOf(t)>=0||t.indexOf(c)>=0;
}
function buildCampaignDailyBreakdown(camp,shopee,meta,limitDays){
  camp=camp||{};shopee=shopee||[];meta=meta||[];limitDays=limitDays||7;
  var campName=camp.campaign||'';
  var byDate={};
  function ensure(d){if(!byDate[d])byDate[d]={date:d,spend:0,comm:0,orders:0,items:0,clicks:0,lp:0,ids:{},roas:0,roasLabel:'–'};return byDate[d];}
  meta.forEach(function(r){
    if(!r||!r.date||r.campaign!==campName) return;
    var d=ensure(r.date);
    d.spend+=(r.spend||0)*(1+getPPN());
    d.clicks+=r.clicks||0;
    d.lp+=r.lp||0;
  });
  shopee.forEach(function(r){
    if(!r||!r.filterDate||!campaignMatchesTag(campName,r.tag1)) return;
    var d=ensure(r.filterDate);
    d.comm+=r.comm||0;
    d.items++;
    if(r.orderId)d.ids[r.orderId]=1;
  });
  return Object.keys(byDate).sort().slice(-limitDays).map(function(k){
    var r=byDate[k];
    r.orders=Object.keys(r.ids||{}).length;
    r.roas=r.spend?r.comm/r.spend:0;
    r.roasLabel=r.spend?fmtX(r.roas):(r.comm>0?'profit':'–');
    return r;
  });
}

function buildTagDailyBreakdown(tag,shopee,meta,limitDays){
  tag=tag||{};shopee=shopee||[];meta=meta||[];limitDays=limitDays||7;
  var tagName=tag.tag||'';
  var campName=tag.matchedCamp||'';
  var byDate={};
  function ensure(d){if(!byDate[d])byDate[d]={date:d,spend:0,comm:0,orders:0,items:0,clicks:0,lp:0,ids:{},roas:0,roasLabel:'–'};return byDate[d];}
  meta.forEach(function(r){
    if(!r||!r.date||!campName||r.campaign!==campName) return;
    var d=ensure(r.date);
    d.spend+=(r.spend||0)*(1+getPPN());
    d.clicks+=r.clicks||0;
    d.lp+=r.lp||0;
  });
  shopee.forEach(function(r){
    if(!r||!r.filterDate||r.tag1!==tagName) return;
    var d=ensure(r.filterDate);
    d.comm+=r.comm||0;
    d.items++;
    if(r.orderId)d.ids[r.orderId]=1;
  });
  var rows=Object.keys(byDate).sort().slice(-limitDays).map(function(k){
    var r=byDate[k];
    r.orders=Object.keys(r.ids||{}).length;
    r.roas=r.spend?r.comm/r.spend:0;
    r.roasLabel=r.spend?fmtX(r.roas):(r.comm>0?'profit':'–');
    return r;
  });
  return rows;
}

function aggByGroup(shopee){
  var g={};
  shopee.forEach(function(r){
    var grp=getPlatGroup(r.platform||'Others');
    if(!g[grp])g[grp]={comm:0,items:0,orders:{}};
    g[grp].comm+=r.comm;g[grp].items++;g[grp].orders[r.orderId]=1;
  });
  return g;
}

function destroyCharts(){Object.values(charts).forEach(function(c){try{c.destroy();}catch(e){}});charts={};}

// ─── TOGGLE COMMISSION NOTE DETAIL ───
function toggleCommNote(){
  var det=document.getElementById('comm-note-detail');
  var btn=document.getElementById('comm-note-toggle');
  if(!det||!btn) return;
  var open=det.classList.toggle('open');
  btn.textContent=open?'Sembunyikan':'Selengkapnya';
}

function rerender(){
  var bs=document.getElementById('btn-semua'),bt=document.getElementById('btn-terbaru');
  var s=document.getElementById('d-start')&&document.getElementById('d-start').value;
  var e=document.getElementById('d-end')&&document.getElementById('d-end').value;
  if(bs&&bt){
    var isSemua=s===rawMin&&e===rawMax;
    var isTerbaru=s===rawMax&&e===rawMax;
    bs.classList.toggle('og',isSemua);
    bt.classList.toggle('og',isTerbaru&&!isSemua);
  }
  renderTrafficFilters();
  destroyCharts();
  var f=getFiltered(),meta=f.meta,shopee=f.shopee,shopeeClicks=f.shopeeClicks||[];
  s=f.s;e=f.e;
  var agg=aggDate(meta,shopee),m=agg.m,sv=agg.sv,allD=agg.allD;
  var tSpend=meta.reduce(function(a,r){return a+r.spend;},0);
  var tComm=shopee.reduce(function(a,r){return a+r.comm;},0);
  var ppn=getPPN();
  var tSpendPPN=tSpend*(1+ppn);
  var tNet=tComm-tSpendPPN,tRoas=tSpendPPN?tComm/tSpendPPN:0;
  var tClicks=meta.reduce(function(a,r){return a+r.clicks;},0);
  var tLp=meta.reduce(function(a,r){return a+r.lp;},0);
  var tItems=shopee.length,tZero=shopee.filter(function(r){return r.comm===0;}).length;
  var tOrders=Object.keys(shopee.reduce(function(a,r){a[r.orderId]=1;return a;},{})).length;

  document.querySelectorAll('.nav-item[data-tab]').forEach(function(el){el.classList.toggle('active',el.dataset.tab===activeTab);});
  var TITLES={overview:'Overview',campaigns:'Campaigns',products:'Produk & Kategori',funnel:'Funnel Konversi',attribution:'Atribusi Tag',history:'History'};
  document.getElementById('tab-title').textContent=TITLES[activeTab]||'';
  document.getElementById('period-lbl').textContent=s&&e?(s===e?'Tanggal: '+s:s+' s/d '+e):'Semua periode · '+rawMin+' – '+rawMax;
  var historyMode=activeTab==='history';
  ['traffic-filter-wrap','alerts-section','prog-card','kpi-grid','akun-summary-strip'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display=historyMode?'none':'';});
  if(historyMode){
    document.getElementById('period-lbl').textContent='Snapshot analisa tersimpan · membuka history tidak menggabungkan data';
    renderHistoryTab();
    return;
  }

  var alerts='';
  if(rawMinMeta&&rawMinShopee){
    var metaRange=rawMinMeta+(rawMaxMeta!==rawMinMeta?' – '+rawMaxMeta:'');
    var shopeeRange=rawMinShopee+(rawMaxShopee!==rawMinShopee?' – '+rawMaxShopee:'');
    if(rawMinMeta!==rawMinShopee||rawMaxMeta!==rawMaxShopee){
      alerts+='<div class="alert alert-warn"><span>⚠</span><span>Range tanggal berbeda — Meta: <strong>'+metaRange+'</strong> · Shopee: <strong>'+shopeeRange+'</strong>. ROAS harian paling akurat jika range sama. Gunakan filter tanggal untuk menyamakan.</span></div>';
    }
  }

  var expandedMeta=meta.filter(function(r){return (r.rangeDays||1)>1;});
  if(expandedMeta.length){
    var maxRange=Math.max.apply(null,expandedMeta.map(function(r){return r.rangeDays||1;}));
    alerts+='<div class="alert alert-warn"><span>⚠</span><span>Meta CSV terdeteksi format <strong>range '+maxRange+' hari</strong>, bukan breakdown harian. Total spend range tetap dipakai untuk KPI/Campaign/Atribusi jika range-nya overlap dengan filter tanggal, tapi <strong>Spend harian tidak diisi</strong> supaya tidak bikin angka palsu. Untuk tahu spend per hari, export Meta dengan breakdown/time increment <strong>Day</strong>.</span></div>';
  }

  var allPlats=getAllPlatforms();
  var totalPlats=Object.keys(allPlats).length;
  if(activePlatforms.size<totalPlats){
    var activeGroupNames=[];
    var grpSeen={};
    Array.from(activePlatforms).forEach(function(p){
      var g=getPlatGroup(p);
      if(!grpSeen[g]){grpSeen[g]=true;activeGroupNames.push(GROUP_META[g]?GROUP_META[g].label:g);}
    });
    alerts+='<div class="alert alert-info" style="background:rgba(168,85,247,.08);border-color:rgba(168,85,247,.25);color:#c4b5fd;"><span>🎯</span><span>Filter trafik aktif: <strong>'+activeGroupNames.join(', ')+'</strong> · Klik <strong>Semua</strong> untuk reset.</span></div>';
  }

  var readyWsAll=workspaces.filter(function(w){return isWorkspaceReady(w);});
  if(readyWsAll.length>1&&activeWorkspaces.size<readyWsAll.length){
    var activeWsNames=readyWsAll.filter(function(w){return activeWorkspaces.has(w.id);}).map(function(w){return w.name||('Workspace '+w.id);});
    alerts+='<div class="alert alert-info" style="background:rgba(99,179,237,.07);border-color:rgba(99,179,237,.25);color:#90cdf4;"><span>🗂</span><span>Filter workspace aktif: <strong>'+escHtml(activeWsNames.join(', '))+'</strong> · Data hanya dari workspace ini.</span></div>';
  }

  var doneAkuns=shopeeAccounts.filter(function(a){return a.done;});
  if(doneAkuns.length>1&&activeAkuns.size<doneAkuns.length){
    var activeAkunNames=doneAkuns.filter(function(a){return activeAkuns.has(a.id);}).map(function(a){return a.label;});
    alerts+='<div class="alert alert-info" style="background:rgba(238,77,45,.07);border-color:rgba(238,77,45,.25);color:#fca5a5;"><span>🏪</span><span>Filter akun aktif: <strong>'+escHtml(activeAkunNames.join(', '))+'</strong> · Data hanya dari akun ini.</span></div>';
  }

  var langNote='';
  if(window._metaLang==='id') langNote='<div class="alert alert-info">ℹ Meta CSV terdeteksi dalam <strong>Bahasa Indonesia</strong> — semua kolom terbaca normal.</div>';
  var shopeeHasEN=shopeeData.some(function(r){return r.lang==='en';});
  var shopeeHasID=shopeeData.some(function(r){return r.lang==='id';});
  if(shopeeHasEN&&shopeeHasID) langNote+='<div class="alert alert-info">ℹ Shopee CSV terdeteksi <strong>campuran Bahasa Inggris & Indonesia</strong> — keduanya terbaca normal.</div>';
  else if(shopeeHasEN) langNote+='<div class="alert alert-info">ℹ Shopee CSV terdeteksi dalam <strong>English</strong> — semua kolom terbaca normal.</div>';

  // ─── COMMISSION DISCREPANCY NOTE (selalu muncul, bisa di-collapse) ───
  var commNote=
    '<div class="comm-note" id="comm-note-banner">'+
      '<span class="comm-note-icon">ℹ</span>'+
      '<div>'+
        '<strong>Kenapa komisi di sini beda dengan dashboard Shopee?</strong> — Ini normal. CSV ini pakai <strong>Komisi Bersih</strong> (sudah diproses), sedangkan dashboard Shopee nampilkan <strong>Komisi Kotor</strong> (belum final).'+
        ' <button class="comm-note-toggle" id="comm-note-toggle" onclick="toggleCommNote()">Selengkapnya</button>'+
        '<div class="comm-note-detail" id="comm-note-detail">'+
          'Shopee punya delay pemrosesan: order yang sudah tercatat di dashboard performa Shopee belum tentu sudah masuk ke CSV affiliate dengan nilai final. '+
          'Ada beberapa penyebab selisih ini: <strong>(1)</strong> order masih berstatus Tertunda dan belum diverifikasi, '+
          '<strong>(2)</strong> komisi sedang dalam masa tunggu sebelum dikonfirmasi, '+
          '<strong>(3)</strong> sebagian kecil order bisa kena revisi komisi oleh sistem Shopee. '+
          'Selisihnya akan makin mengecil kalau lo export CSV beberapa hari setelah periode berakhir, bukan langsung hari itu juga.'+
        '</div>'+
      '</div>'+
    '</div>';

  document.getElementById('alerts-section').innerHTML=alerts+langNote+commNote;

  var progDate=e||rawMax;
  var tMeta=metaData.filter(function(r){return r.date===progDate;});
  var tSh=shopeeData.filter(function(r){return r.filterDate===progDate&&activePlatforms.has(r.platform||'Others')&&(activeAkuns.size===0||activeAkuns.has(r.akunId));});
  var tS2raw=tMeta.reduce(function(a,r){return a+r.spend;},0);
  var tS2=tS2raw*(1+getPPN());
  var tC2=tSh.reduce(function(a,r){return a+r.comm;},0);
  var tN2=tC2-tS2,prog=Math.min(100,Math.max(0,tN2/getTarget()*100));
  var pc=tN2>=getTarget()?'#4ade80':tN2>0?'#EE4D2D':'#f87171';
  document.getElementById('prog-card').innerHTML=
    '<div class="progress-header"><span>'+progDate+' &nbsp;·&nbsp; Net Rp '+fmt(tN2)+' / target Rp '+fmt(getTarget())+'</span><span class="progress-pct" style="color:'+pc+';">'+prog.toFixed(0)+'%</span></div>'+
    '<div class="progress-track"><div class="progress-fill" style="width:'+prog+'%;background:'+pc+';"></div></div>'+
    '<div class="progress-stats">'+
      '<span class="progress-stat">Spend: <strong>Rp '+fmt(tS2)+'</strong></span>'+
      '<span class="progress-stat">Komisi: <strong>Rp '+fmt(tC2)+'</strong></span>'+
      (tS2?'<span class="progress-stat">ROAS: <strong class="'+rc(tC2/tS2)+'">'+fmtX(tC2/tS2)+'</strong></span>':'')+
      (tS2?'<span class="progress-stat">ROI: <strong class="'+rcROI(tS2,tC2)+'">'+fmtROI(tS2,tC2)+'</strong></span>':'')+
      '<span class="progress-stat">Orders: <strong>'+Object.keys(tSh.reduce(function(a,r){a[r.orderId]=1;return a;},{})).length+'</strong></span>'+
    '</div>';

  document.getElementById('kpi-grid').innerHTML=[
    {l:'Spend + PPN'+(fmtPPN()?' ('+fmtPPN()+')':''),v:'Rp '+fmtK(tSpendPPN),s:ppn>0?'Spend: Rp'+fmtK(tSpend)+' · PPN: Rp'+fmtK(tSpendPPN-tSpend):'Biaya iklan Meta'},
    {l:'Total Komisi',v:'Rp '+fmtK(tComm),c:tComm>=tSpend?'color-gr':''},
    {l:'Net Profit'+(ppn>0?' (incl. PPN)':''),v:(tNet>=0?'+ ':'')+' Rp '+fmtK(tNet),c:tNet>=0?'color-gr':'color-rd'},
    {l:'ROAS'+(ppn>0?' (incl. PPN)':''),v:fmtX(tRoas),c:rc(tRoas)},
    {l:'ROI'+(ppn>0?' (incl. PPN)':''),v:fmtROI(tSpendPPN,tComm),c:rcROI(tSpendPPN,tComm),s:'(Komisi−Spend)/Spend'},
    {l:'Meta Clicks',v:fmt(tClicks),s:'CPC: Rp '+fmt(tClicks?tSpend/tClicks:0)},
    {l:'LP Views (Meta)',v:fmt(tLp),s:'LP rate: '+fmtPct(tClicks?tLp/tClicks:0)},
    {l:'Unique Orders',v:fmt(tOrders),s:'Komisi/order: Rp '+fmt(tOrders?tComm/tOrders:0)},
    {l:'Zero Komisi',v:fmtPct(tItems?tZero/tItems:0),c:tItems&&tZero/tItems>0.35?'color-rd':'color-am',s:fmt(tZero)+' dari '+fmt(tItems)+' item'},
  ].map(function(k){return'<div class="kpi-card"><div class="kpi-label">'+helpWrap(k.l)+'</div><div class="kpi-val '+(k.c||'')+'">'+k.v+'</div>'+(k.s?'<div class="kpi-sub">'+k.s+'</div>':'')+'</div>';}).join('');

  var akunStrip=document.getElementById('akun-summary-strip');
  if(akunStrip){
    var readyWsList=workspaces.filter(function(w){return isWorkspaceReady(w);});
    if(readyWsList.length<=1){akunStrip.style.display='none';}
    else{
      akunStrip.style.display='flex';
      akunStrip.innerHTML=readyWsList.map(function(ws){
        var wsShopee=shopee.filter(function(r){return r.wsId===ws.id;});
        var wsMeta=meta.filter(function(r){return r.wsId===ws.id;});
        var wsComm=wsShopee.reduce(function(a,r){return a+r.comm;},0);
        var wsSpend=wsMeta.reduce(function(a,r){return a+r.spend;},0)*(1+ppn);
        var wsNet=wsComm-wsSpend;
        var wsRoas=wsSpend?wsComm/wsSpend:0;
        var wsOrd=Object.keys(wsShopee.reduce(function(a,r){a[r.orderId]=1;return a;},{})).length;
        var pct=tComm?Math.round(wsComm/tComm*100):0;
        return '<div style="flex:1;min-width:160px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:12px 14px;">'+
          '<div style="font-size:10px;color:var(--text3);margin-bottom:5px;text-transform:uppercase;letter-spacing:.04em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+escHtml(ws.name||('Workspace '+ws.id))+'</div>'+
          '<div style="font-size:15px;font-weight:600;color:#4ade80;">Rp '+fmtK(wsComm)+'</div>'+
          '<div style="display:flex;gap:10px;margin-top:4px;flex-wrap:wrap;">'+
            '<span style="font-size:10px;color:var(--text3);">ROAS <strong class="'+rc(wsRoas)+'">'+fmtX(wsRoas)+'</strong></span>'+
            '<span style="font-size:10px;color:var(--text3);">Net <strong class="'+(wsNet>=0?'color-gr':'color-rd')+'">Rp '+fmtK(wsNet)+'</strong></span>'+
            '<span style="font-size:10px;color:var(--text3);">'+pct+'% · '+wsOrd+' orders</span>'+
          '</div>'+
        '</div>';
      }).join('');
    }
  }

  renderTab(meta,shopee,m,sv,allD,tSpendPPN,tComm,tClicks,tLp,tOrders,shopeeClicks);
}

function sortCampaigns(key){
  if(campSortKey===key){
    campSortDir*=-1;
  } else {
    campSortKey=key;
    campSortDir=-1;
  }
  var f=getFiltered();
  renderCampaigns(f.meta,f.shopee);
}

function renderCampaigns(meta,shopee){
  var ppn=getPPN();
  var body=document.getElementById('tab-body');
  if(!body) return;

  var cols=[
    {key:'campaign', label:'Campaign',     asc:true,  getValue:function(c){return c.campaign;},
     render:function(c){return '<td style="font-weight:500;max-width:200px;overflow:hidden;text-overflow:ellipsis;" title="'+escHtml(c.campaign)+'">'+escHtml(c.campaign)+'</td>';}},
    {key:'spend',    label:'Spend',                   getValue:function(c){return c.spend*(1+ppn);},
     render:function(c){return '<td class="color-muted">'+fmt(c.spend*(1+ppn))+'</td>';}},
    {key:'clicks',   label:'Clicks',                  getValue:function(c){return c.clicks;},
     render:function(c){return '<td>'+fmt(c.clicks)+'</td>';}},

    {key:'ctr',      label:'CTR',                     getValue:function(c){return c.impressions?c.clicks/c.impressions:0;},
     render:function(c){return '<td class="color-muted">'+fmtPct(c.impressions?c.clicks/c.impressions:0)+'</td>';}},
    {key:'cpc',      label:'CPC (Rp)',                getValue:function(c){return c.clicks?c.spend/c.clicks:0;},
     render:function(c){return '<td class="color-muted">'+fmt(c.clicks?c.spend/c.clicks:0)+'</td>';}},
    {key:'cpm',      label:'CPM (Rp)',                getValue:function(c){return c.impressions?c.spend/c.impressions*1000:0;},
     render:function(c){return '<td class="color-muted">'+fmt(c.impressions?c.spend/c.impressions*1000:0)+'</td>';}},

  ];

  var camps=aggCamp(meta);

  camps.sort(function(a,b){
    var col=cols.find(function(c){return c.key===campSortKey;});
    if(!col) return 0;
    var va=col.getValue(a), vb=col.getValue(b);
    if(typeof va==='string') return campSortDir*(va.localeCompare(vb,'id'));
    return campSortDir*(va-vb);
  });

  var upSvg='<svg class="sort-up" viewBox="0 0 8 5" fill="currentColor"><path d="M4 0L8 5H0z"/></svg>';
  var downSvg='<svg class="sort-down" viewBox="0 0 8 5" fill="currentColor"><path d="M4 5L0 0h8z"/></svg>';

  var thead='<tr>'+cols.map(function(col){
    var isActive=campSortKey===col.key;
    var dirClass=isActive?(campSortDir===-1?'desc':'asc'):'';
    return '<th class="sortable '+dirClass+'" data-sortkey="'+col.key+'">'+
      helpWrap(col.label)+
      '<span class="sort-icon">'+upSvg+downSvg+'</span>'+
    '</th>';
  }).join('')+'</tr>';

  var NCOLS=cols.length;
  var tbody=camps.map(function(c){
    var isOpen=expandedCampaign===c.campaign;
    var dailyRows=buildCampaignDailyBreakdown(c,shopee||[],meta,7);
    var dailyHtml=dailyRows.length?
      '<div class="tag-detail-title">Breakdown Harian 7 Hari Terakhir</div>'+
      '<table class="tag-prod-table">'+
        '<thead><tr>'+['Tanggal','Spend','Komisi','ROAS','Orders','Klik Meta'].map(function(h){return'<th>'+h+'</th>';}).join('')+'</tr></thead><tbody>'+
        dailyRows.map(function(d){
          var roasCls=d.spend?rc(d.roas):(d.comm>0?'color-gr':'color-muted');
          return'<tr>'+
            '<td>'+escHtml(d.date)+'</td>'+
            '<td class="color-muted">Rp '+fmt(d.spend)+'</td>'+
            '<td class="color-og" style="font-weight:500;">Rp '+fmt(d.comm)+'</td>'+
            '<td class="'+roasCls+'" style="font-weight:600;">'+escHtml(d.roasLabel)+'</td>'+
            '<td class="color-muted">'+fmt(d.orders)+'</td>'+
            '<td class="color-muted">'+fmt(d.clicks)+'</td>'+
          '</tr>';
        }).join('')+
      '</tbody></table>':'<div class="tag-detail-title">Breakdown Harian 7 Hari Terakhir</div><div class="color-muted" style="font-size:12px;">Belum ada data harian untuk campaign ini di filter tanggal aktif.</div>';
    return '<tr class="tag-row '+(isOpen?'expanded':'')+'" data-campaign="'+escHtml(c.campaign)+'">'+cols.map(function(col){return col.render(c);}).join('')+'</tr>'+
      '<tr class="tag-detail-row '+(isOpen?'open':'')+'"><td colspan="'+NCOLS+'"><div class="tag-detail-inner">'+dailyHtml+'</div></td></tr>';
  }).join('');

  body.innerHTML=
    '<div class="table-card">'+
      '<div class="table-card-header">Performa Campaign '+
        '<span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--text3);">'+
          'Klik header kolom untuk sortir · fokus metrik Meta yang paling stabil: spend, clicks, CTR, CPC, CPM'+
        '</span>'+
      '</div>'+
      '<div class="table-wrap"><table>'+
        '<thead>'+thead+'</thead>'+
        '<tbody>'+tbody+'</tbody>'+
      '</table></div>'+
    '</div>'+
    '<div class="alert alert-info" style="margin-top:0;">ℹ ROAS per campaign tersedia di tab Atribusi setelah Tag_link1 diisi saat buat link Shopee Affiliate.</div>';

  body.querySelector('table').addEventListener('click',function(e){
    var th=e.target.closest('th[data-sortkey]');
    if(th){
      var key=th.getAttribute('data-sortkey');
      if(key) sortCampaigns(key);
      return;
    }
    var row=e.target.closest('tr[data-campaign]');
    if(row){
      var c=row.getAttribute('data-campaign')||'';
      expandedCampaign=expandedCampaign===c?'':c;
      renderCampaigns(meta,shopee||[]);
    }
  });
}

function toggleTagDetail(rowId, detId){
  var row=document.getElementById(rowId);
  var det=document.getElementById(detId);
  if(!row||!det) return;
  var isOpen=det.classList.contains('open');
  document.querySelectorAll('.tag-detail-row.open').forEach(function(el){
    el.classList.remove('open');
  });
  document.querySelectorAll('.tag-row.expanded').forEach(function(el){
    el.classList.remove('expanded');
  });
  if(!isOpen){
    det.classList.add('open');
    row.classList.add('expanded');
    setTimeout(function(){det.scrollIntoView({behavior:'smooth',block:'nearest'});},50);
  }
}

function switchTab(t){
  activeTab=t;
  try{
    if(typeof gtag!=='undefined') gtag('event','tab_view',{tab_name:t});
    if(typeof fbq!=='undefined') fbq('trackCustom','TabView',{tab:t});
  }catch(e){}
  rerender();
}

function renderTab(meta,shopee,mByD,svByD,allD,tSpend,tComm,tClicks,tLp,tOrders,shopeeClicks){
  var ppn=getPPN();
  var tSpendPPN=tSpend;
  var body=document.getElementById('tab-body');

  if(activeTab==='overview'){
    var labels=allD.slice(-14),lShort=labels.map(function(d){return d.slice(5);});
    var spends=labels.map(function(d){return mByD[d]?mByD[d].spend:0;});
    var comms=labels.map(function(d){return svByD[d]?svByD[d].comm:0;});
    var nets=labels.map(function(d){return(svByD[d]?svByD[d].comm:0)-(mByD[d]?mByD[d].spend:0);});
    body.innerHTML=
      '<div class="charts-grid">'+
        '<div class="chart-card"><div class="chart-title">Spend vs Komisi</div><div style="position:relative;height:200px;"><canvas id="ch-sc"></canvas></div></div>'+
        '<div class="chart-card"><div class="chart-title">Net Profit Harian</div><div style="position:relative;height:200px;"><canvas id="ch-net"></canvas></div></div>'+
      '</div>'+
      '<div class="table-card"><div class="table-card-header">Rekap Harian <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--text3);">komisi by Waktu Pemesanan (tanggal order)</span></div>'+
        '<div class="table-wrap"><table class="overview-daily-table"><thead><tr>'+
          ['Tanggal','Spend','Komisi','Net','ROAS','ROI','EPC','Meta Clicks','LP Views','LP Rate','Orders','Zero%'].map(function(h){return thHelp(h);}).join('')+'</tr></thead><tbody>'+
        labels.slice().reverse().map(function(d){
          var md=mByD[d]||{spend:0,clicks:0,lp:0};
          var sd=svByD[d]||{comm:0,items:0,ids:{},zero:0};
          var spendPPN=md.spend*(1+ppn); var net=sd.comm-spendPPN,roas=spendPPN?sd.comm/spendPPN:0;
          var epc=md.clicks?sd.comm/md.clicks:0, cpcEff=md.clicks?spendPPN/md.clicks:0;
          var lpR=md.clicks?md.lp/md.clicks:0;
          var lpCls=lpR>=0.4?'color-gr':lpR>=0.2?'color-am':'color-rd';
          return'<tr><td style="font-weight:500;">'+d+'</td>'+
            '<td class="color-muted">'+fmt(md.spend*(1+ppn))+'</td><td>'+fmt(sd.comm)+'</td>'+
            '<td class="'+(net>=0?'color-gr':'color-rd')+'" style="font-weight:500;">'+(net>=0?'+':'')+fmt(net)+'</td>'+
            '<td class="'+rc(roas)+'" style="font-weight:500;">'+fmtX(roas)+'</td>'+
            '<td class="'+rcROI(spendPPN,sd.comm)+'" style="font-weight:500;">'+fmtROI(spendPPN,sd.comm)+'</td>'+
            '<td class="'+(md.clicks?(epc>=cpcEff?'color-gr':'color-rd'):'color-muted')+'" style="font-weight:500;">'+(md.clicks?'Rp '+fmt(epc):'–')+'</td>'+
            '<td class="color-muted">'+fmt(md.clicks)+'</td><td class="color-muted">'+fmt(md.lp)+'</td>'+
            '<td class="'+lpCls+'">'+fmtPct(lpR)+'</td>'+
            '<td>'+Object.keys(sd.ids||{}).length+'</td>'+
            '<td class="'+(sd.items&&sd.zero/sd.items>0.3?'color-rd':'color-am')+'">'+(sd.items?fmtPct(sd.zero/sd.items):'–')+'</td>'+
          '</tr>';
        }).join('')+'</tbody></table></div></div>';
    var cOpts={responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#999',font:{size:10},boxWidth:10,padding:12}}},scales:{x:{ticks:{color:'#666',font:{size:10}},grid:{color:'rgba(255,255,255,.04)'}},y:{ticks:{color:'#666',font:{size:10},callback:function(v){return'Rp'+fmtK(v);}},grid:{color:'rgba(255,255,255,.04)'}}}};
    charts.sc=new Chart(document.getElementById('ch-sc'),{type:'bar',data:{labels:lShort,datasets:[{label:'Spend',data:spends,backgroundColor:'rgba(136,136,136,.35)',borderRadius:3},{label:'Komisi',data:comms,backgroundColor:'rgba(238,77,45,.65)',borderRadius:3}]},options:cOpts});
    charts.net=new Chart(document.getElementById('ch-net'),{type:'bar',data:{labels:lShort,datasets:[{data:nets,backgroundColor:nets.map(function(n){return n>=0?'rgba(74,222,128,.65)':'rgba(248,113,113,.65)';}),borderRadius:3}]},options:Object.assign({},cOpts,{plugins:{legend:{display:false},tooltip:{callbacks:{label:function(ctx){return'Net: Rp'+fmt(ctx.raw);}}}},scales:cOpts.scales})});
  }

  else if(activeTab==='campaigns'){
    renderCampaigns(meta,shopee);
  }

  else if(activeTab==='products'){
    var cats=aggCat(shopee),prods=aggProd(shopee),plats=aggPlat(shopee);
    var tIt=shopee.length,tZ=shopee.filter(function(r){return r.comm===0;}).length;
    var nz=shopee.filter(function(r){return r.comm>0;});
    var avgC=nz.length?nz.reduce(function(a,r){return a+r.comm;},0)/nz.length:0;

    var grpBreak=aggByGroup(shopee);
    var grpOrder=['sosmed','organic'];
    var grpBreakHtml=grpOrder.filter(function(g){return grpBreak[g];}).map(function(g){
      var meta2=GROUP_META[g];
      var gb=grpBreak[g];
      var pct=tComm?Math.round(gb.comm/tComm*100):0;
      var orders=Object.keys(gb.orders).length;
      return'<div class="kpi-card" style="border-color:'+meta2.color+'22;">'+
        '<div class="kpi-label" style="display:flex;align-items:center;gap:5px;"><span style="width:7px;height:7px;border-radius:50%;background:'+meta2.color+';display:inline-block;flex-shrink:0;"></span>'+meta2.label+'</div>'+
        '<div class="kpi-val" style="font-size:16px;">Rp '+fmtK(gb.comm)+'</div>'+
        '<div class="kpi-sub">'+pct+'% dari total · '+orders+' orders</div></div>';
    }).join('');

    body.innerHTML=
      '<div style="margin-bottom:12px;"><div class="table-card-header" style="padding:0 0 8px;border-bottom:none;margin-bottom:8px;">Komisi per Channel</div>'+
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:20px;">'+grpBreakHtml+'</div></div>'+
      '<div class="charts-grid">'+
        '<div class="chart-card"><div class="chart-title">Komisi per Kategori</div><div style="position:relative;height:220px;"><canvas id="ch-cat"></canvas></div></div>'+
        '<div class="chart-card"><div class="chart-title">Platform Klik</div><div style="position:relative;height:220px;"><canvas id="ch-plat"></canvas></div></div>'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">'+
        '<div class="kpi-card"><div class="kpi-label">Zero commission rate</div><div class="kpi-val '+(tIt&&tZ/tIt>0.35?'color-rd':'color-am')+'">'+fmtPct(tIt?tZ/tIt:0)+'</div><div class="kpi-sub">'+fmt(tZ)+' dari '+fmt(tIt)+' item</div></div>'+
        '<div class="kpi-card"><div class="kpi-label">Avg komisi / item (non-zero)</div><div class="kpi-val">Rp '+fmt(avgC)+'</div><div class="kpi-sub">'+fmt(nz.length)+' item yang dapat komisi</div></div>'+
      '</div>'+
      '<div class="table-card"><div class="table-card-header">Top 15 Produk by Komisi</div>'+
        '<div class="table-wrap"><table><thead><tr>'+
          ['Produk','Kategori','Komisi (Rp)','Items','Avg / Item'].map(function(h){return'<th>'+h+'</th>';}).join('')+'</tr></thead><tbody>'+
        prods.map(function(p){return'<tr><td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;" title="'+p.product+'">'+p.product+'</td>'+
          '<td class="color-muted" style="font-size:11px;">'+p.cat+'</td><td class="color-og" style="font-weight:500;">'+fmt(p.comm)+'</td>'+
          '<td class="color-muted">'+p.items+'</td><td class="color-muted">Rp '+fmt(p.comm/p.items)+'</td></tr>';}).join('')+
        '</tbody></table></div></div>';
    var dOpts={responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:'#999',font:{size:10},padding:8,boxWidth:10}}}};
    charts.cat=new Chart(document.getElementById('ch-cat'),{type:'doughnut',data:{labels:cats.slice(0,8).map(function(c){return c.cat.slice(0,16);}),datasets:[{data:cats.slice(0,8).map(function(c){return Math.round(c.comm);}),backgroundColor:CAT_COLORS,borderWidth:2,borderColor:'#1a1a1a'}]},options:dOpts});
    charts.plat=new Chart(document.getElementById('ch-plat'),{type:'doughnut',data:{labels:plats.map(function(p){return p.platform;}),datasets:[{data:plats.map(function(p){return Math.round(p.comm);}),backgroundColor:CAT_COLORS,borderWidth:2,borderColor:'#1a1a1a'}]},options:dOpts});
  }

  else if(activeTab==='funnel'){
    var tImpr=meta.reduce(function(a,r){return a+r.impressions;},0);
    var tCl=meta.reduce(function(a,r){return a+r.clicks;},0);
    var tLP2=meta.reduce(function(a,r){return a+r.lp;},0);
    var steps=[
      {l:'Impresi',v:tImpr,sub:'Tayangan iklan Meta',pv:null,color:'#555'},
      {l:'Link Clicks',v:tCl,sub:'Klik iklan (Meta)',pv:tImpr,color:'#EE4D2D'},
      {l:'Landing Page Views',v:tLP2,sub:'Pixel load berhasil (Meta)',pv:tCl,color:'#d97706'},
      {l:'Unique Orders',v:tOrders,sub:'Pesanan di Shopee (by order date)',pv:tCl,color:'#22863a'},
      {l:'Total Komisi',v:tComm,sub:'Komisi bersih affiliate (Rp)',pv:null,isRp:true,color:'#4ade80'},
    ];
    var sHtml=steps.map(function(st){
      var rate=st.pv&&st.pv>0?st.v/st.pv*100:null;
      var barW=tImpr>0&&!st.isRp?Math.max(2,Math.min(100,st.v/tImpr*100)):null;
      var rCls=rate===null?'':rate>=50?'pill-gr':rate>=20?'pill-am':'pill-rd';
      return'<div class="funnel-step">'+
        '<div class="funnel-step-header"><div class="funnel-step-label">'+st.l+'</div>'+
        '<div class="funnel-step-right"><div class="funnel-step-val">'+(st.isRp?'Rp '+fmt(st.v):fmt(st.v))+'</div>'+
        (rate!==null?'<span class="pill '+rCls+'">'+rate.toFixed(1)+'%</span>':'')+
        '</div></div>'+
        (barW!==null?'<div class="funnel-bar-track"><div class="funnel-bar-fill" style="width:'+barW+'%;background:'+st.color+';"></div></div>':'')+
        '<div class="funnel-sub">'+st.sub+'</div></div>';
    }).join('');
    var ratios=[
      {l:'Click-to-LP',v:tCl?fmtPct(tLP2/tCl):'–',n:'LP views / Clicks',c:tCl&&tLP2/tCl>=0.4?'color-gr':'color-am'},
      {l:'Click-to-Order',v:tCl&&tOrders?fmtPct(tOrders/tCl):'–',n:'Orders / Clicks',c:''},
      {l:'Cost per Order'+(ppn>0?' +PPN':''),v:tOrders?'Rp '+fmt(tSpendPPN/tOrders):'–',n:'Spend+PPN / Orders',c:''},
      {l:'Komisi per Order',v:tOrders?'Rp '+fmt(tComm/tOrders):'–',n:'Komisi / Orders',c:'color-gr'},
      {l:'EPC (Komisi/Klik)',v:tCl?'Rp '+fmt(tComm/tCl):'–',n:'Komisi / Meta clicks',c:tCl&&tComm/tCl>=tSpendPPN/tCl?'color-gr':'color-rd'},
      {l:'ROI'+(ppn>0?' (incl. PPN)':''),v:fmtROI(tSpendPPN,tComm),n:'(Komisi−Spend) / Spend',c:rcROI(tSpendPPN,tComm)},
      {l:'CPC Efektif'+(ppn>0?' +PPN':''),v:tCl?'Rp '+fmt(tSpendPPN/tCl):'–',n:'Spend+PPN / Clicks',c:''},
    ];
    body.innerHTML='<div class="funnel-wrap">'+
      '<div class="chart-card" style="padding:20px;">'+sHtml+'</div>'+
      '<div><div class="ratios-grid">'+
        ratios.map(function(k){return'<div class="ratio-card"><div class="ratio-label">'+helpWrap(k.l)+'</div><div class="ratio-val '+(k.c||'')+'">'+k.v+'</div><div class="ratio-note">'+k.n+'</div></div>';}).join('')+
      '</div></div></div>';
  }

  else if(activeTab==='attribution'){
    var rawTags=aggTag(shopee,meta,shopeeClicks);
    var tags=sortAttributionTags(filterAttributionTags(rawTags, attrFilters), attrSort.key, attrSort.dir);
    var rawHasReal=rawTags.some(function(t){return t.tag&&t.tag!=='(no tag)';});
    var hasReal=tags.some(function(t){return t.tag&&t.tag!=='(no tag)';});
    if(!rawHasReal){
      body.innerHTML='<div class="empty-state"><div class="empty-state-title">Belum ada tag terdeteksi</div><div class="empty-state-body">Isi <code>Tag_link1</code> saat generate link Shopee Affiliate dengan nama campaign Meta (contoh: <code>cetak-barcode-1</code>). Dashboard akan otomatis matching dan hitung ROAS per-campaign.</div></div>';
      return;
    }

    var NCOLS=16;

    var tbodyHtml=tags.map(function(t,ti){
      var net=t.comm-t.spend,hasM=t.matchedCamp&&t.spend>0;
      var rowId='tag-row-'+ti;
      var detId='tag-det-'+ti;

      var summaryTr=
        '<tr class="tag-row" id="'+rowId+'" data-rowid="'+rowId+'" data-detid="'+detId+'" title="Klik baris untuk lihat detail produk">'+
          '<td style="font-weight:500;"><span class="tag-chevron">▶</span>'+escHtml(t.tag)+'</td>'+
          '<td style="font-size:11px;color:var(--og);">'+escHtml(t.akunLabel||'–')+'</td>'+
          '<td class="td-match '+(hasM?'':'color-muted')+'" title="'+(hasM?escHtml(t.matchedCamp):'Campaign belum match')+'">'+(hasM?escHtml(t.matchedCamp):'–')+'</td>'+
          '<td class="color-muted">'+(hasM?fmt(t.spend):'–')+'</td>'+
          '<td class="color-og" style="font-weight:500;">'+fmt(t.comm)+'</td>'+
          '<td class="'+(hasM?(net>=0?'color-gr':'color-rd'):'color-muted')+'" style="font-weight:500;">'+(hasM?(net>=0?'+':'')+fmt(net):'–')+'</td>'+
          '<td class="'+(hasM?rc(t.roas):'color-muted')+'" style="font-weight:500;">'+(hasM?fmtX(t.roas):'–')+'</td>'+
          '<td class="'+(hasM?rcROI(t.spend,t.comm):'color-muted')+'" style="font-weight:500;">'+(hasM?fmtROI(t.spend,t.comm):'–')+'</td>'+
          '<td class="'+(hasM&&t.clicks?'color-muted':'color-muted')+'" style="font-weight:500;">'+(hasM&&t.clicks?'Rp '+fmt(t.cpc):'–')+'</td>'+
          '<td class="'+(hasM&&t.clicks?(t.epc>=t.cpc?'color-gr':'color-rd'):'color-muted')+'" style="font-weight:500;">'+(hasM&&t.clicks?'Rp '+fmt(t.epc):'–')+'</td>'+
          '<td class="td-newuser '+(t.newUserCount?'color-am':'color-muted')+'" style="font-weight:500;" title="Status Pemebelian/Pembelian = Baru dan komisi ≥ Rp50rb: '+fmt(t.newUserCount)+' item, bonus Rp '+fmt(t.newUserComm||0)+'">'+(t.newUserCount?fmt(t.newUserCount):'0')+'</td>'+
          '<td style="font-weight:500;">'+recoHtml(t)+'</td>'+
          '<td>'+t.orderCount+'</td>'+
          '<td class="color-muted">'+(t.orderCount?'Rp '+fmt(t.comm/t.orderCount):'–')+'</td>'+
          '<td class="'+(hasM&&t.shopeeClicks?'color-muted':'color-muted')+'" style="font-weight:500;">'+(hasM&&t.shopeeClicks?'Rp '+fmt(t.realCpc):'–')+'</td>'+
          '<td class="'+(hasM&&t.clicks?(t.shopeeClickRate>=0.5?'color-gr':t.shopeeClickRate>=0.2?'color-am':'color-rd'):'color-muted')+'" style="font-weight:500;">'+(hasM&&t.clicks&&t.shopeeClicks?fmtPct(t.shopeeClickRate):'–')+'</td>'+ 
        '</tr>';

      var tagRows=shopee.filter(function(r){return(r.tag1||'(no tag)')===t.tag;});

      var prodMap={};
      tagRows.forEach(function(r){
        var pk=(r.product||'').slice(0,60)||'(produk tidak diketahui)';
        if(!prodMap[pk])prodMap[pk]={product:pk,cat:r.cat1||'–',comm:0,items:0,statuses:{},buyerStatuses:{},newUsers:0};
        prodMap[pk].comm+=r.comm;
        prodMap[pk].items++;
        prodMap[pk].statuses[r.status]=(prodMap[pk].statuses[r.status]||0)+1;
        var buyerStatus=r.purchaseStatus||'–';
        prodMap[pk].buyerStatuses[buyerStatus]=(prodMap[pk].buyerStatuses[buyerStatus]||0)+1;
        if(isNewUserBonusRow(r)) prodMap[pk].newUsers++;
      });
      var prods=Object.values(prodMap).sort(function(a,b){return b.comm-a.comm;});

      var platMap={};
      tagRows.forEach(function(r){var p=r.platform||'Others';platMap[p]=(platMap[p]||0)+1;});
      var platStr=Object.keys(platMap).map(function(p){return p+' ('+platMap[p]+')';}).join(' · ');

      var statMap={};
      tagRows.forEach(function(r){statMap[r.status]=(statMap[r.status]||0)+1;});
      var statStr=Object.keys(statMap).map(function(s){
        var cls=s==='Completed'||s==='Selesai'?'color-gr':s==='Cancelled'||s==='Dibatalkan'?'color-rd':'color-am';
        return'<span class="'+cls+'">'+s+' '+statMap[s]+'</span>';
      }).join(' · ');

      var prodTableHtml=
        '<div class="tag-detail-inner">'+
          '<div class="tag-stats-row">'+
            '<span class="tag-stat">Platform: <strong>'+platStr+'</strong></span>'+
            '<span class="tag-stat">Status: '+statStr+'</span>'+
          '</div>'+
          '<div class="tag-detail-title">'+prods.length+' Produk</div>'+
          '<table class="tag-prod-table">'+
            '<thead><tr>'+
              ['Produk','Kategori','Komisi (Rp)','Items','Avg/Item','Status terbanyak'].map(function(h){return'<th>'+h+'</th>';}).join('')+
            '</tr></thead><tbody>'+
            prods.map(function(p){
              var topStatus=Object.keys(p.statuses).sort(function(a,b){return p.statuses[b]-p.statuses[a];})[0]||'–';
              var stCls=topStatus==='Completed'||topStatus==='Selesai'?'color-gr':topStatus==='Cancelled'||topStatus==='Dibatalkan'?'color-rd':'color-am';
              return'<tr>'+
                '<td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="'+escHtml(p.product)+'">'+escHtml(p.product)+'</td>'+
                '<td class="color-muted" style="font-size:10px;">'+escHtml(p.cat)+'</td>'+
                '<td class="color-og" style="font-weight:500;">'+fmt(p.comm)+'</td>'+
                '<td class="color-muted">'+p.items+'</td>'+
                '<td class="color-muted">Rp '+fmt(p.items?p.comm/p.items:0)+'</td>'+
                '<td class="'+stCls+'" style="font-size:10px;">'+topStatus+'</td>'+
              '</tr>';
            }).join('')+
          '</tbody></table>'+
        '</div>';

      var detailTr=
        '<tr class="tag-detail-row" id="'+detId+'">'+
          '<td colspan="'+NCOLS+'" style="padding:0;">'+prodTableHtml+'</td>'+
        '</tr>';

      return summaryTr+detailTr;
    }).join('');

    body.innerHTML=
      '<div class="table-card">'+
        '<div class="table-card-header">Atribusi per Tag '+
          '<span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--text3);">'+
            'Klik baris untuk lihat detail produk per tag'+
          '</span>'+
        '</div>'+
        '<div class="attr-filter-bar">'+
          '<div class="attr-filter-field"><label>Min Spend</label><input id="attr-min-spend" inputmode="numeric" placeholder="contoh 60000" value="'+escHtml(attrFilters.minSpend||'')+'"></div>'+
          '<div class="attr-filter-field"><label>Max Spend</label><input id="attr-max-spend" inputmode="numeric" placeholder="opsional" value="'+escHtml(attrFilters.maxSpend||'')+'"></div>'+
          '<button type="button" class="attr-filter-btn" id="attr-filter-apply">Terapkan</button>'+
          '<button type="button" class="attr-filter-btn" id="attr-filter-clear">Reset</button>'+
          '<div class="attr-filter-note">Tampil '+fmt(tags.length)+' dari '+fmt(rawTags.length)+' tag</div>'+
        '</div>'+
        '<div class="table-wrap"><table>'+
          '<thead><tr>'+
            [
              ['Tag (link1)','tag'],['Akun','akun'],['Match','match'],['Spend','spend'],['Komisi','comm'],['Net','net'],['ROAS','roas'],['ROI','roi'],['CPC Meta','cpc'],['EPC','epc'],['NEW USER','newUser'],['Rekomendasi','reco'],['Orders','orders'],['Avg/Order','avgOrder'],['Real CPC','realCpc'],['Real Rate','realRate']
            ].map(function(col){
              var h=col[0],key=col[1];
              var help={'CPC Meta':1,'Real CPC':1,'Real Rate':1,'EPC':1,'NEW USER':1,'Rekomendasi':1};
              var labelHtml=h==='Tag (link1)'?'<span style="padding-left:18px;">'+escHtml(h)+'</span>':undefined;
              return help[h]?thAttrSort(h,key,helpWrap(h,labelHtml)):thAttrSort(h,key,labelHtml);
            }).join('')+
          '</tr></thead>'+
          '<tbody>'+tbodyHtml+'</tbody>'+
        '</table></div>'+renderAttributionSummary(tags)+
      '</div>';

    var minEl=body.querySelector('#attr-min-spend');
    var maxEl=body.querySelector('#attr-max-spend');
    function applyAttrFilters(){
      attrFilters.minSpend=minEl?minEl.value.trim():'';
      attrFilters.maxSpend=maxEl?maxEl.value.trim():'';
      rerender();
    }
    body.querySelector('#attr-filter-apply')?.addEventListener('click',applyAttrFilters);
    body.querySelector('#attr-filter-clear')?.addEventListener('click',function(){attrFilters.minSpend='';attrFilters.maxSpend='';rerender();});
    [minEl,maxEl].forEach(function(el){if(el)el.addEventListener('keydown',function(e){if(e.key==='Enter')applyAttrFilters();});});

    var tbl=body.querySelector('table');
    if(tbl){
      tbl.querySelectorAll('th[data-attr-sort]').forEach(function(th){
        th.addEventListener('click',function(e){
          e.preventDefault();
          e.stopPropagation();
          var key=this.getAttribute('data-attr-sort');
          if(attrSort.key===key) attrSort.dir=attrSort.dir==='asc'?'desc':'asc';
          else { attrSort.key=key; attrSort.dir=(key==='tag'||key==='akun'||key==='match'||key==='reco')?'asc':'desc'; }
          rerender();
        });
      });
      tbl.addEventListener('click',function(e){
        var row=e.target.closest('tr[data-detid]');
        if(!row) return;
        toggleTagDetail(row.getAttribute('data-rowid'), row.getAttribute('data-detid'));
      });
    }
  }
}

// ─── TOAST SYSTEM ───
function showToast(opts){
  var wrap=document.getElementById('toast-wrap');
  if(!wrap) return;
  var t=document.createElement('div');
  t.className='toast';

  var ctaHtml='';
  if(opts.cta&&opts.cta.length){
    ctaHtml='<div class="toast-actions">';
    opts.cta.forEach(function(c){
      if(c.href){
        ctaHtml+='<a href="'+c.href+'" target="_blank" rel="noopener" class="toast-cta'+(c.primary?' primary':' ghost')+'">'+c.label+'</a>';
      } else {
        ctaHtml+='<button class="toast-cta'+(c.primary?' primary':' ghost')+'" onclick="'+c.onclick+'">'+c.label+'</button>';
      }
    });
    ctaHtml+='</div>';
  }

  t.innerHTML=
    '<div class="toast-icon">'+opts.icon+'</div>'+
    '<div class="toast-body">'+
      '<div class="toast-title">'+opts.title+'</div>'+
      '<div class="toast-msg">'+opts.msg+'</div>'+
      ctaHtml+
    '</div>';

  wrap.appendChild(t);

  var dur=opts.duration||6000;
  var timer=setTimeout(function(){dismissToast(t);},dur);
  t.addEventListener('click',function(e){
    if(e.target.tagName==='A'||e.target.tagName==='BUTTON') return;
    clearTimeout(timer);
    dismissToast(t);
  });
}

function dismissToast(el){
  el.classList.add('hiding');
  setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el);},260);
}

// ─── EXPORT TO XLSX ───
function exportToXLSX(){
  if(typeof XLSX==='undefined'){alert('SheetJS belum siap, coba lagi sebentar.');return;}
  var btn=document.getElementById('nav-export');
  if(btn){btn.classList.add('exporting');}

  setTimeout(function(){
    try{
      var wb=XLSX.utils.book_new();
      var ppn=getPPN();
      var f=getFiltered();
      var meta=f.meta, shopee=f.shopee, shopeeClicks=f.shopeeClicks||[], s=f.s, e=f.e;
      var period=s&&e?(s===e?s:s+' s/d '+e):'Semua periode';
      var akunLabel=shopeeAccounts.filter(function(a){return a.done;}).map(function(a){return a.label;}).join(', ')||'Semua Akun';

      function makeSheet(aoaData, colWidths){
        var ws=XLSX.utils.aoa_to_sheet(aoaData);
        ws['!cols']=colWidths.map(function(w){return{wch:w};});
        return ws;
      }

      var agg=aggDate(meta,shopee);
      var mByD=agg.m, svByD=agg.sv, allD=agg.allD;
      var tSpend=meta.reduce(function(a,r){return a+r.spend;},0);
      var tComm=shopee.reduce(function(a,r){return a+r.comm;},0);
      var tSpendPPN=tSpend*(1+ppn);
      var tNet=tComm-tSpendPPN;
      var tRoas=tSpendPPN?tComm/tSpendPPN:0;
      var tOrders=Object.keys(shopee.reduce(function(a,r){a[r.orderId]=1;return a;},{})).length;

      var rows1=[
        ['Shopee Affiliate Dashboard — Export'],
        ['Periode: '+period+' | Akun: '+akunLabel+(ppn>0?' | PPN: '+(ppn*100).toFixed(0)+'%':'')],
        ['Catatan: Kolom "Komisi" di file ini adalah Komisi Bersih dari CSV affiliate, bukan Komisi Kotor dari dashboard Shopee. Angka ini bisa lebih rendah karena Shopee butuh waktu memproses order sebelum komisi dikonfirmasi.'],
        [],
        ['RINGKASAN'],
        ['Total Spend+PPN','Total Komisi Bersih','Net Profit','ROAS','ROI','EPC','Unique Orders'],
        [tSpendPPN,tComm,tNet,tRoas,tSpendPPN?parseFloat(((tComm-tSpendPPN)/tSpendPPN*100).toFixed(2)):0,meta.reduce(function(a,r){return a+r.clicks;},0)?Math.round(tComm/meta.reduce(function(a,r){return a+r.clicks;},0)):0,tOrders],
        [],
        ['DETAIL HARIAN'],
        ['Tanggal','Spend','PPN','Spend+PPN','Komisi Bersih','Net Profit','ROAS','ROI (%)','EPC (Rp)','Meta Clicks','LP Views','LP Rate','Unique Orders','Item','Zero Komisi','Zero%'],
      ];
      allD.slice().reverse().forEach(function(d){
        var md=mByD[d]||{spend:0,clicks:0,lp:0};
        var sd=svByD[d]||{comm:0,items:0,ids:{},zero:0};
        var spendPPN=md.spend*(1+ppn);
        var net=sd.comm-spendPPN;
        var roas=spendPPN?sd.comm/spendPPN:0;
        var lpR=md.clicks?md.lp/md.clicks:0;
        var epc=md.clicks?sd.comm/md.clicks:0;
        var orders=Object.keys(sd.ids||{}).length;
        rows1.push([
          d,
          Math.round(md.spend),
          Math.round(md.spend*ppn),
          Math.round(spendPPN),
          Math.round(sd.comm),
          Math.round(net),
          parseFloat(roas.toFixed(3)),
          spendPPN?parseFloat(((sd.comm-spendPPN)/spendPPN*100).toFixed(2)):0,
          Math.round(epc),
          md.clicks,
          md.lp,
          parseFloat(lpR.toFixed(4)),
          orders,
          sd.items,
          sd.zero,
          sd.items?parseFloat((sd.zero/sd.items).toFixed(4)):0,
        ]);
      });
      rows1.push([
        'TOTAL',
        Math.round(tSpend),
        Math.round(tSpend*ppn),
        Math.round(tSpendPPN),
        Math.round(tComm),
        Math.round(tNet),
        parseFloat(tRoas.toFixed(3)),
        tSpendPPN?parseFloat(((tComm-tSpendPPN)/tSpendPPN*100).toFixed(2)):0,
        meta.reduce(function(a,r){return a+r.clicks;},0)?Math.round(tComm/meta.reduce(function(a,r){return a+r.clicks;},0)):0,
        meta.reduce(function(a,r){return a+r.clicks;},0),
        meta.reduce(function(a,r){return a+r.lp;},0),
        '',
        tOrders,
        shopee.length,
        shopee.filter(function(r){return r.comm===0;}).length,
        '',
      ]);

      var ws1=makeSheet(rows1,[12,14,12,14,14,14,8,9,11,14,14,10,14,10,13,9]);
      XLSX.utils.book_append_sheet(wb,ws1,'Overview Harian');

      var camps=aggCamp(meta);
      var rows2=[
        ['PERFORMA CAMPAIGN'],
        ['Periode: '+period+(ppn>0?' | PPN: '+(ppn*100).toFixed(0)+'%':'')],
        [],
        ['Campaign','Spend (Rp)','PPN (Rp)','Spend+PPN','Clicks','LP Views','LP Rate','CTR','CPC (Rp)','CPM (Rp)','Hari Aktif'],
      ];
      camps.forEach(function(c){
        var lpR=c.clicks?c.lp/c.clicks:0;
        var ctr=c.impressions?c.clicks/c.impressions:0;
        var cpc=c.clicks?c.spend/c.clicks:0;
        var cpm=c.impressions?c.spend/c.impressions*1000:0;
        rows2.push([
          c.campaign,
          Math.round(c.spend),
          Math.round(c.spend*ppn),
          Math.round(c.spend*(1+ppn)),
          c.clicks,
          c.lp,
          parseFloat(lpR.toFixed(4)),
          parseFloat(ctr.toFixed(4)),
          Math.round(cpc),
          Math.round(cpm),
          c.days,
        ]);
      });
      var totCampSpend=camps.reduce(function(a,c){return a+c.spend;},0);
      var totCampClicks=camps.reduce(function(a,c){return a+c.clicks;},0);
      var totCampLP=camps.reduce(function(a,c){return a+c.lp;},0);
      rows2.push(['TOTAL',Math.round(totCampSpend),Math.round(totCampSpend*ppn),Math.round(totCampSpend*(1+ppn)),totCampClicks,totCampLP,totCampClicks?parseFloat((totCampLP/totCampClicks).toFixed(4)):'','','','','']);

      var ws2=makeSheet(rows2,[36,14,12,14,12,12,10,10,12,12,10]);
      XLSX.utils.book_append_sheet(wb,ws2,'Campaigns');

      var prods=aggProd(shopee);
      var cats=aggCat(shopee);
      var rows3=[
        ['TOP PRODUK BY KOMISI'],
        ['Periode: '+period+' | Akun: '+akunLabel],
        [],
        ['Produk','Kategori','Komisi (Rp)','Items','Avg Komisi/Item'],
      ];
      prods.forEach(function(p){
        rows3.push([
          p.product,
          p.cat,
          Math.round(p.comm),
          p.items,
          Math.round(p.comm/p.items),
        ]);
      });
      rows3.push([]);
      rows3.push(['KOMISI PER KATEGORI']);
      rows3.push(['Kategori','Komisi (Rp)','Items','% dari Total']);
      var totCat=cats.reduce(function(a,c){return a+c.comm;},0);
      cats.forEach(function(c){
        rows3.push([
          c.cat,
          Math.round(c.comm),
          c.items,
          totCat?parseFloat((c.comm/totCat).toFixed(4)):0,
        ]);
      });
      var ws3=makeSheet(rows3,[55,28,14,10,16]);
      XLSX.utils.book_append_sheet(wb,ws3,'Produk & Kategori');

      var tags=aggTag(shopee,meta,shopeeClicks);
      var rows4=[
        ['ATRIBUSI PER TAG (Tag_link1)'],
        ['Periode: '+period+' | Akun: '+akunLabel],
        [],
        ['Tag_link1','Akun','Campaign Match','Spend+PPN (Rp)','Komisi Bersih (Rp)','Komisi Normal excl Bonus NEW USER (Rp)','Bonus NEW USER (Rp50rb/item)','NEW USER Bonus Count (Status Baru + Komisi>=50rb)','Net Normal (Rp)','Net Profit (Rp)','ROAS','ROAS Normal','ROI (%)','ROI Normal (%)','CPC Meta (Rp)','EPC (Rp)','EPC Normal (Rp)','Meta Clicks','Rekomendasi','Alasan Rekomendasi','Orders','Avg Komisi/Order','Real CPC (Rp)','Real Rate (%)'],
      ];
      tags.forEach(function(t){
        var net=t.comm-t.spend;
        var normalComm=t.normalComm!==undefined?t.normalComm:t.comm;
        var normalNet=normalComm-t.spend;
        var normalRoas=t.spend?normalComm/t.spend:0;
        var rec=recommendTag(t);
        rows4.push([
          t.tag,
          t.akunLabel||'–',
          t.matchedCamp||'–',
          t.spend?Math.round(t.spend):0,
          Math.round(t.comm),
          Math.round(normalComm),
          Math.round(t.newUserComm||0),
          t.newUserCount||0,
          t.spend?Math.round(normalNet):0,
          t.spend?Math.round(net):0,
          t.spend?parseFloat(t.roas.toFixed(3)):0,
          t.spend?parseFloat(normalRoas.toFixed(3)):0,
          t.spend?parseFloat(((t.comm-t.spend)/t.spend*100).toFixed(2)):0,
          t.spend?parseFloat(((normalComm-t.spend)/t.spend*100).toFixed(2)):0,
          t.clicks?Math.round(t.cpc):0,
          t.clicks?Math.round(t.epc):0,
          t.clicks?Math.round(t.normalEpc||0):0,
          t.clicks||0,
          rec.label,
          rec.title+' — Arahan: '+(rec.action||'')+' — Alasan: '+rec.reasons.join(' | '),
          t.orderCount,
          t.orderCount?Math.round(t.comm/t.orderCount):0,
          t.shopeeClicks?Math.round(t.realCpc):0,
          t.clicks?parseFloat((t.shopeeClickRate*100).toFixed(2)):0,
        ]);
      });
      var ws4=makeSheet(rows4,[24,18,36,16,14,20,20,16,16,16,8,11,9,13,14,14,14,11,14,72,10,18,14,14]);
      XLSX.utils.book_append_sheet(wb,ws4,'Atribusi Tag');

      var rows5=[
        ['RAW ORDER DATA — Shopee Affiliate'],
        ['Periode: '+period+' | Akun: '+akunLabel],
        [],
        ['Workspace','Akun','ID Pesanan','Status','Tgl Order','Tgl Klik','Produk','Kategori','Platform','Tag_link1','Nilai Beli (Rp)','Komisi Bersih (Rp)'],
      ];
      shopee.forEach(function(r){
        rows5.push([
          r.wsName||'–',
          r.akunLabel||'–',
          r.orderId,
          r.status,
          r.filterDate,
          r.clickDate,
          r.product,
          r.cat1,
          r.platform,
          r.tag1||'',
          Math.round(r.purchase),
          Math.round(r.comm),
        ]);
      });
      var ws5=makeSheet(rows5,[18,18,22,14,12,12,50,24,20,20,16,14]);
      XLSX.utils.book_append_sheet(wb,ws5,'Raw Orders');

      var today=new Date();
      var dd=String(today.getDate()).padStart(2,'0');
      var mm=String(today.getMonth()+1).padStart(2,'0');
      var yyyy=today.getFullYear();
      var fname='affiliate-report-'+yyyy+mm+dd+'.xlsx';

      XLSX.writeFile(wb,fname);

      try{
        var f2=getFiltered();
        var orderCount=Object.keys(f2.shopee.reduce(function(a,r){a[r.orderId]=1;return a;},{})).length;
        if(typeof gtag!=='undefined') gtag('event','export_completed',{order_count:orderCount,period:fname});
        if(typeof fbq!=='undefined') fbq('trackCustom','ExportCompleted',{order_count:orderCount});
      }catch(e){}

    } catch(err){
      alert('Export gagal: '+err.message);
      console.error(err);
      return;
    } finally {
      if(btn){btn.classList.remove('exporting');}
    }

    showToast({
      icon:'🎉',
      title:'File berhasil didownload!',
      msg:'Laporan Excel berhasil diekspor.',
      duration:5000
    });
  },50);
}

// ─── BARRY SERVER HISTORY ───
function compactShopeeClicks(rows){
  var m={};
  (rows||[]).forEach(function(r){
    var key=[r.date||'',r.tag||'',r.tagNorm||normalizeTag(r.tag||''),r.platform||r.referrer||'Others',r.wsId||'',r.wsName||''].join('||');
    if(!m[key]) m[key]={date:r.date||'',tag:r.tag||'',tagNorm:r.tagNorm||normalizeTag(r.tag||''),platform:r.platform||r.referrer||'Others',referrer:r.referrer||r.platform||'Others',wsId:r.wsId,wsName:r.wsName,count:0};
    m[key].count+=Number(r.count||1);
  });
  return Object.values(m);
}
function snapshotPayload(){
  return {
    metaData: metaData || [],
    shopeeData: shopeeData || [],
    shopeeClickData: compactShopeeClicks(shopeeClickData || []),
    workspaces: (workspaces || []).map(function(w){return {id:w.id,name:w.name,metaDone:!!w.metaDone,clickDone:!!w.clickDone,shopeeAccounts:(w.shopeeAccounts||[]).map(function(a){return {id:a.id,label:a.label,done:!!a.done};})};}),
    shopeeAccounts: (shopeeAccounts || []).map(function(a){return {id:a.id,label:a.label,done:!!a.done};}),
    rawMin: rawMin, rawMax: rawMax, rawMinMeta: rawMinMeta, rawMaxMeta: rawMaxMeta, rawMinShopee: rawMinShopee, rawMaxShopee: rawMaxShopee
  };
}
function currentSnapshotTitle(){
  var parts=[];
  if(rawMin||rawMax) parts.push((rawMin||'?')+(rawMax&&rawMax!==rawMin?' s/d '+rawMax:''));
  if(workspaces&&workspaces.length) parts.push(workspaces.map(function(w){return w.name||('Workspace '+w.id);}).join(', '));
  return parts.join(' — ') || 'Analisa Affiliate';
}
async function autoSaveCurrentSnapshot(){
  if((!metaData||!metaData.length)&&(!shopeeData||!shopeeData.length)) return;
  try{
    var res=await fetch('/api/snapshots',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:currentSnapshotTitle(),payload:snapshotPayload()})});
    var j=await res.json();
    if(!res.ok) throw new Error(j.message||j.error||'Auto-save failed');
    showToast({icon:j.duplicate?'ℹ️':'✅',title:j.duplicate?'History sudah ada':'Auto-save berhasil',msg:j.duplicate?'Data ini sudah pernah tersimpan.':'Analisa otomatis tersimpan ke server.',duration:3500});
    loadHistoryList(false);
  }catch(e){
    showToast({icon:'⚠️',title:'Auto-save gagal',msg:e.message||'Coba refresh lalu jalankan analisa lagi.',duration:6000});
  }
}
async function saveCurrentSnapshot(){
  if((!metaData||!metaData.length)&&(!shopeeData||!shopeeData.length)){alert('Belum ada data untuk disimpan. Upload dan Mulai Analisa dulu.');return;}
  try{
    var res=await fetch('/api/snapshots',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:currentSnapshotTitle(),payload:snapshotPayload()})});
    var j=await res.json();
    if(!res.ok) throw new Error(j.message||j.error||'Save failed');
    showToast({icon:j.duplicate?'ℹ️':'✅',title:j.duplicate?'Data sudah pernah disimpan':'History tersimpan',msg:j.duplicate?'Snapshot ini duplikat, tidak disimpan ulang. ID: '+j.id:'Snapshot ID '+j.id+' berhasil disimpan ke server.',duration:5000});
    loadHistoryList(false);
  }catch(e){alert('Gagal simpan history: '+e.message);}
}
async function loadHistoryList(showPanel){
  try{
    var res=await fetch('/api/history/days');
    var j=await res.json();
    if(!res.ok) throw new Error(j.message||j.error||'Load failed');
    renderHistoryList(j.days||[]);
    if(showPanel!==false) showHistoryPanel();
  }catch(e){
    showToast({icon:'⚠️',title:'History belum dapat dimuat',msg:e.message,duration:8000,cta:res&&res.status===401?[{label:'Login kembali',href:'/login',primary:true}]:[]});
  }
}
function clearHistoryList(){
  ['history-list-tab','history-list-upload'].forEach(function(id){var el=document.getElementById(id);if(el){el.style.display='none';el.innerHTML='';}});
}
function showHistoryPanel(){
  switchTab('history');
  loadHistoryList(false);
}
function renderHistoryTab(){
  var body=document.getElementById('tab-body');
  if(!body) return;
  body.innerHTML=
    '<div class="history-box" style="margin-top:0;">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'+
        '<div>'+
          '<div class="history-title">History Analisa</div>'+
          '<div class="history-sub">Pilih 1 snapshot untuk dibuka. History tidak digabung, jadi periode yang overlap tidak bikin data dobel.</div>'+
        '</div>'+
        '<button class="btn-sm og" onclick="loadHistoryList(false)">Refresh</button>'+
      '</div>'+
      '<div id="history-list-tab" class="history-list" style="margin-top:10px;"></div>'+
    '</div>';
  loadHistoryList(false);
}
function localIsoDate(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function historyDateLabel(dateStr){
  if(!dateStr) return 'Tanpa tanggal';
  var today=new Date(); today.setHours(0,0,0,0);
  var d=new Date(dateStr+'T00:00:00');
  var diff=Math.round((today-d)/(24*60*60*1000));
  if(diff===0) return 'Hari ini';
  if(diff===1) return 'Kemarin';
  if(diff===2) return '2 hari lalu';
  if(diff>2 && diff<7) return diff+' hari lalu';
  return dateStr;
}
function renderHistoryList(items){
  var html='';
  if(!items.length){html='<div class="history-item"><div class="history-item-main"><div class="history-item-title">Belum ada data harian</div><div class="history-item-meta">Upload file, klik Mulai Analisa, lalu dashboard otomatis tersimpan per tanggal.</div></div></div>';}
  items.forEach(function(x){
    var sid=x.latest_snapshot_id||x.id;
    var date=x.date||x.date_to||x.date_from||'';
    html+='<div class="history-item">'+
      '<div class="history-item-main"><div class="history-item-title">'+escHtml(historyDateLabel(date))+' · '+escHtml(date)+'</div>'+
      '<div class="history-item-meta">'+(x.snapshot_count||1)+' upload tersimpan · Meta '+(x.total_meta_rows||x.meta_rows||0)+' rows · Shopee '+(x.total_shopee_rows||x.shopee_rows||0)+' rows · update '+escHtml((x.latest_created_at||x.created_at||'').replace('T',' '))+'</div></div>'+
      '<div class="history-actions"><button class="btn-sm og" onclick="loadSnapshot('+sid+')">Buka</button></div>'+ 
      '</div>';
  });
  ['history-list-tab','history-list-upload'].forEach(function(id){var el=document.getElementById(id);if(el){el.innerHTML=html;el.style.display='grid';}});
}
async function loadSnapshot(id){
  try{
    var res=await fetch('/api/snapshots/'+id);
    var j=await res.json();
    if(!res.ok) throw new Error(j.message||j.error||'Load failed');
    restoreSnapshot(j.payload||{});
    showToast({icon:'📂',title:'History loaded',msg:'Snapshot #'+id+' sudah dibuka.',duration:4000});
  }catch(e){alert('Gagal buka snapshot: '+e.message);}
}
async function deleteSnapshot(id){
  if(!confirm('Hapus snapshot #'+id+' dari server?')) return;
  try{
    var res=await fetch('/api/snapshots/'+id,{method:'DELETE'});
    var j=await res.json();
    if(!res.ok) throw new Error(j.message||j.error||'Delete failed');
    loadHistoryList(false);
  }catch(e){alert('Gagal hapus snapshot: '+e.message);}
}
function restoreSnapshot(payload){
  metaData=payload.metaData||[];
  shopeeData=payload.shopeeData||[];
  shopeeClickData=payload.shopeeClickData||[];
  workspaces=payload.workspaces&&payload.workspaces.length?payload.workspaces:[];
  shopeeAccounts=payload.shopeeAccounts||[];
  rawMin=payload.rawMin||''; rawMax=payload.rawMax||'';
  rawMinMeta=payload.rawMinMeta||''; rawMaxMeta=payload.rawMaxMeta||'';
  rawMinShopee=payload.rawMinShopee||''; rawMaxShopee=payload.rawMaxShopee||'';
  if(!rawMin||!rawMax){
    var metaDates=metaData.reduce(function(a,r){if(r.rangeStart)a.push(r.rangeStart);else if(r.date)a.push(r.date);if(r.rangeEnd&&r.rangeEnd!==r.rangeStart)a.push(r.rangeEnd);return a;},[]).filter(Boolean).sort();
    var shopeeDates=shopeeData.map(function(r){return r.filterDate;}).filter(Boolean).sort();
    var allDates=metaDates.concat(shopeeDates).sort(); rawMin=allDates[0]||''; rawMax=allDates[allDates.length-1]||'';
    rawMinMeta=metaDates[0]||''; rawMaxMeta=metaDates[metaDates.length-1]||''; rawMinShopee=shopeeDates[0]||''; rawMaxShopee=shopeeDates[shopeeDates.length-1]||'';
  }
  document.getElementById('d-start').value=rawMin; document.getElementById('d-end').value=rawMax;
  document.getElementById('up-screen').style.display='none'; document.getElementById('dash-screen').style.display='block';
  activePlatforms=new Set(); activeAkuns=new Set(); activeWorkspaces=new Set();
  var allPlats={}; shopeeData.forEach(function(r){var p=r.platform||'Others';allPlats[p]=1;activeAkuns.add(r.akunId);activeWorkspaces.add(r.wsId);});
  metaData.forEach(function(r){activeWorkspaces.add(r.wsId);}); Object.keys(allPlats).forEach(function(p){activePlatforms.add(p);});
  window._metaLang=metaData.length&&metaData[0].lang?metaData[0].lang:'en';
  activeTab='overview';
  renderTrafficFilters(); rerender();
}

// TUTORIAL
var tutIdx=0,tutTotal=5;
function openTutorial(){tutIdx=0;renderTutorial();document.getElementById('tut-overlay').classList.add('open');}
function closeTutorial(){document.getElementById('tut-overlay').classList.remove('open');}
function formatTargetInput(el){var raw=el.value.replace(/[^0-9]/g,'');if(!raw){el.value='';return;}el.value=parseInt(raw).toLocaleString('id-ID');}
function closeTutorialOutside(e){if(e.target===document.getElementById('tut-overlay'))closeTutorial();}
function tutGoTo(i){tutIdx=i;renderTutorial();}
function tutNext(){if(tutIdx<tutTotal-1){tutIdx++;renderTutorial();}else{closeTutorial();}}
function tutPrev(){if(tutIdx>0){tutIdx--;renderTutorial();}}
function renderTutorial(){
  for(var i=0;i<tutTotal;i++){
    var s=document.getElementById('tut-'+i);var t=document.querySelectorAll('.tut-tab')[i];
    if(s)s.classList.toggle('active',i===tutIdx);if(t)t.classList.toggle('active',i===tutIdx);
  }
  var dots='';for(var i=0;i<tutTotal;i++)dots+='<div class="tut-dot'+(i===tutIdx?' active':'')+'"></div>';
  document.getElementById('tut-dots').innerHTML=dots;
  var prev=document.getElementById('tut-prev'),next=document.getElementById('tut-next');
  if(prev){prev.style.opacity=tutIdx===0?'0.3':'1';prev.disabled=tutIdx===0;}
  if(next)next.textContent=tutIdx===tutTotal-1?'Selesai ✓':'Selanjutnya →';
}

setTimeout(function(){loadHistoryList(false);},0);

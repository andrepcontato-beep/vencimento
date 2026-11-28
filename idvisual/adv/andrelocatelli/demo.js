/* Modo demonstração: dados 100% fictícios, cofre separado do real (locatelli-demo), sem nuvem. */
window.DEMO_SEED=async function(){
  const d=k=>{const t=new Date();t.setDate(t.getDate()+k);return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0')};
  const ago=k=>Date.now()-k*864e5,id=()=>Math.random().toString(36).slice(2,10);
  const L=(t,k)=>({id:id(),t,d:d(k)}),P=(v,k,o)=>({id:id(),v,d:d(-k),o});
  const DOC=(a)=>['RG / CNH','CPF','Comprovante de endereço','Procuração assinada','Contrato assinado','CNIS'].map((t,i)=>({id:id(),t,ok:i<a}));
  const C=[
   {nome:'Maria das Dores Ferreira',cpf:'111.444.777-35',tel:'(62) 99111-2201',beneficios:['BPC/LOAS do idoso'],marcas:['idoso'],origem:'Indicação',
    andamento:[{e:'Contrato assinado',t:ago(40)},{e:'Documentos recebidos',t:ago(32)},{e:'Protocolado',t:ago(20)},{e:'Aguardando análise do INSS',t:ago(12)}],
    honorarios:{valor:1500,obs:'entrada + 2 parcelas',pagamentos:[P(500,38,'Pix')]},lembretes:[L('Perícia social',6)],docs:DOC(6),notas:'Cliente prefere contato à tarde.'},
   {nome:'Ana Clara Souza Prado',cpf:'529.982.247-25',tel:'(62) 99222-3302',beneficios:['Salário-maternidade urbano'],marcas:['gestante'],dpp:d(18),origem:'Orgânico',
    andamento:[{e:'Contrato assinado',t:ago(15)},{e:'Documentos recebidos',t:ago(9)}],honorarios:{valor:1200,obs:'30% do benefício',pagamentos:[P(600,14,'Pix')]},docs:DOC(5)},
   {nome:'João Batista Rocha',cpf:'390.533.447-05',tel:'(62) 99333-4403',beneficios:['BPC/LOAS da pessoa com deficiência'],marcas:['pcd'],origem:'Escritório',
    andamento:[{e:'Contrato assinado',t:ago(60)},{e:'Protocolado',t:ago(45)},{e:'Perícia agendada',t:ago(5)}],honorarios:{valor:2000,obs:'êxito',pagamentos:[P(700,55,'Dinheiro'),P(300,20,'Pix')]},
    lembretes:[L('Perícia médica — INSS',9),L('Audiência de conciliação',21)],docs:DOC(6)},
   {nome:'Pedro Henrique Lima',cpf:'865.373.340-01',nasc:'2016-04-12',sexo:'M',cond:'menor',repr:true,rep:{nome:'Luciana Pereira Lima',cpf:'248.438.034-80',tel:'(62) 99444-5504',nac:'brasileira',ec:'solteira',prof:'cabeleireira',end:'Rua das Flores, 120, Centro',cid:'Piracanjuba/GO'},
    beneficios:['BPC/LOAS da pessoa com deficiência'],marcas:['autismo'],origem:'Indicação',andamento:[{e:'Contrato assinado',t:ago(70)},{e:'Aguardando laudo médico',t:ago(46)}],honorarios:{valor:2500,obs:'entrada + êxito',pagamentos:[P(800,66,'Pix')]},docs:DOC(4)},
   {nome:'Francisca Alves Moreira',cpf:'184.675.560-69',tel:'(62) 99555-6605',beneficios:['Aposentadoria por idade rural'],marcas:['rural','idoso'],origem:'Captação',
    andamento:[{e:'Contrato assinado',t:ago(50)},{e:'Aguardando docs do cliente',t:ago(38)}],honorarios:{valor:1800,obs:'parcelado em 3x',pagamentos:[P(600,48,'Pix')]},docs:DOC(3),lembretes:[L('Cobrar documentos rurais',2)]},
   {nome:'Carlos Eduardo Teixeira',cpf:'074.526.310-30',tel:'(62) 99666-7706',beneficios:['Auxílio-doença (incapacidade temporária)'],marcas:['receita'],origem:'Orgânico',
    andamento:[{e:'Contrato assinado',t:ago(25)},{e:'Protocolado',t:ago(18)},{e:'Cumprimento de exigência',t:ago(3)}],honorarios:{valor:1400,obs:'30% dos atrasados',pagamentos:[]},docs:DOC(6)},
   {nome:'Rosa Maria Gonçalves',cpf:'437.905.230-62',tel:'(62) 99777-8807',beneficios:['Pensão por morte urbana'],marcas:['idoso'],origem:'Indicação',
    andamento:[{e:'Contrato assinado',t:ago(90)},{e:'Protocolado',t:ago(80)},{e:'Deferido',t:ago(10)},{e:'Benefício implantado',t:ago(4)}],honorarios:{valor:1600,obs:'quitado',pagamentos:[P(800,85,'Pix'),P(800,5,'Pix')]},docs:DOC(6)},
   {nome:'Beatriz Nunes Carvalho',cpf:'621.059.980-04',tel:'(62) 99888-9908',beneficios:['Salário-maternidade rural (segurada especial)'],marcas:['gestante','rural'],dpp:d(-3),origem:'Escritório',
    andamento:[{e:'Contrato assinado',t:ago(30)},{e:'Protocolado',t:ago(12)}],honorarios:{valor:1300,obs:'30%',pagamentos:[P(650,28,'Pix')]},docs:DOC(6)}
  ];
  for(const c of C){await COFRE.salvar(c,{semHistorico:true})}
  await COFRE.salvarAvulsos([{id:id(),v:350,d:d(-2),o:'Consulta avulsa — cliente fictício'},{id:id(),v:200,d:d(-9),o:'Elaboração de requerimento'}]);
};

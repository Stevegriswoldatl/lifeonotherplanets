// Life On Other Planets? — submission-readiness scoring.
// Shared by report.html, reports.html (dashboard) and relay.html (AI Lab) so the
// rubric lives in ONE place. Honest analog to a professional False-Positive
// Probability: it flags candidates worth follow-up, it does NOT confirm planets.
//
//   window.LOPReadiness.evaluate(card, consensus, aiFindingCount) -> {tier, score, gates, ...}
//   window.LOPReadiness.LABELS[tier] -> {t, c, bg}
(function(){
  function impliedRe(card){
    var note=null; ((card&&card.checks)||[]).forEach(function(c){ if(c.test==='Implied size')note=c.note; });
    if(note){ var m=note.match(/([\d.]+)\s*Earth/); if(m)return parseFloat(m[1]); }
    return null;
  }
  // card: deck entry (flag_count, checks, teff, st_rad, distance_ly, depth_ppm)
  // cons: card_consensus row (votes, voters, planet_votes, not_votes)
  // aiCount: # of AI Lab findings recorded for this candidate
  function evaluate(card, cons, aiCount){
    card=card||{}; cons=cons||{}; aiCount=aiCount||0;
    var flags=card.flag_count||0, re=impliedRe(card);
    var sizeOk=(re==null)||(re>0 && re<=22);           // implied radius within planet range
    var checksOk=(flags===0)&&sizeOk;                  // Gate 1: no automated red flags
    var v=cons.votes||0, p=cons.planet_votes||0, n=cons.not_votes||0, voters=cons.voters||0;
    var planetAgree=v?p/v:0, notAgree=v?n/v:0, reached=voters>=5 && v>0;
    var crowdPlanet=reached && planetAgree>=0.7;        // Gate 2: crowd consensus, planet
    var crowdNot   =reached && notAgree>=0.7;           // crowd consensus, NOT a planet
    var aiOk=aiCount>=2;                                // Gate 3: some AI deep-research done
    var starOk=(card.teff!=null)&&(card.st_rad!=null)&&(card.distance_ly!=null);  // characterized host
    var tier;
    if(flags>0 || !sizeOk || crowdNot)                 tier='fp';        // disqualified
    else if(checksOk && crowdPlanet && aiOk && starOk) tier='ready';     // all gates
    else if(checksOk && crowdPlanet)                   tier='likely';    // gates 1+2 -> escalate
    else                                               tier='candidate'; // still building
    var s=0;
    s += checksOk?30:0;
    s += Math.round(30*Math.min(1,voters/5)*planetAgree);
    s += aiOk?20:Math.min(20,aiCount*10);
    s += starOk?10:0;
    s += sizeOk?10:0;
    if(tier==='fp') s=Math.min(s,15);
    return {
      tier:tier, score:Math.max(0,Math.min(100,Math.round(s))), re:re,
      gates:{ checks:checksOk, crowd:crowdPlanet, ai:aiOk, star:starOk, size:sizeOk },
      crowdNot:crowdNot, reached:reached, voters:voters,
      planetPct:v?Math.round(p/v*100):0, aiCount:aiCount,
      // what's still needed to reach submission-ready (for UI hints)
      needs:[].concat(!checksOk?['pass the automated checks']:[], !crowdPlanet?['crowd consensus (≥5 obs, ≥70% planet)']:[], !aiOk?['AI Lab deep research']:[], !starOk?['a characterized host star']:[])
    };
  }
  var LABELS={
    fp:       {t:'False positive', c:'#c0631f', bg:'#fdeee2'},
    candidate:{t:'Candidate',      c:'#5a6b85', bg:'#eef2f8'},
    likely:   {t:'Likely planet',  c:'#2b6cb0', bg:'#eef6ff'},
    ready:    {t:'Submission-ready',c:'#0a7d5a', bg:'#e3f6ec'}
  };
  window.LOPReadiness={ evaluate:evaluate, impliedRe:impliedRe, LABELS:LABELS };
})();

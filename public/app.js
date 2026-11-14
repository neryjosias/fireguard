// FIREGUARD - interfaz. Todo el texto de datos se inserta con textContent (sin innerHTML) para evitar XSS.
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
};
const svg = (tag, props = {}, ...kids) => {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(props)) if (v != null) e.setAttribute(k, v);
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
};
const api = async (url, opts = {}) => {
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
  return j;
};
const setStatus = (node, text, kind = '') => { node.textContent = text; node.className = 'status ' + kind; };
const radio = (name) => document.querySelector(`input[name="${name}"]:checked`).value;
const PY_BOUNDS = [[-27.7, -62.7], [-19.2, -54.2]];
const CONF = { high: 'alta', nominal: 'nominal', low: 'baja' };
const COLOR = { modis: '#f5a524', viirs: '#ff4d3a', uni: '#22d3ee', hist: '#4f6b79', rep: '#a78bfa' };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
// Logo de los cuarteles incrustado (PNG 96x96), así no depende de subir una imagen aparte
const STATION_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAADsJSURBVHhe7Z0HmJzVdfeHIkCorPpq+07vZXeFEBKSQAX1XrdKoiOQ6EUSqAOi2RQbgu3Ejj8nNnHcS+K4xP5sDNgYjDHG2HQBkrbvTm/v73vuve87885Ijp04Tux8uc9zNLNT3zn/08+5VxbLX8jK59JIyqbRshm0fLZAaDlyuQz5fFbe5rJpcpkU5Z/xv+sPWJJ5ZZTPKYYLRlPGeEHivniNAMAAIau/V9xm9ec0Lfe/oJxqZTOpAqPLGW9QkeF51NIkQw0QJBAGCRDEZxjv15lvACdByqb//wZDMtsgg+n631J6TYwvSrzB/FMtDY08mniNlj/JRKGJ++Izdc2QoCfJZhKSyq/vf+wyS7VZ6qWpMJGZ+YJ5RTafTKdeSkOUlojPUT4klxWMT5HNCObH5W1BAP4n+42TTIxZAwzJl8AIey7MhWFSlNTn8hni3/8U8SevJ/GEoB1EH9pJ3w230H/TbfTuuJG+Ow8Q//lLJgCERojPUCAWgTeDIG6VcxcAKO1I/s8B4nfZ9HLmF+20kNhSuRYMGfxQG5n1o9A2TkRbL2g8mcVTGK60MzTVzuBUKwMTqjleZaPvq19VEGiCBBDiTtFZG9ejmG+Q0ATjvjJLf9GmqUTaDek/BcnIRb+Vthoh8aUAxJ75LKn1Z8IVVrQr7HC5nfxlNrKb3UR9zQz7mhn0hxnwhxmqtvHBrPnkMpmSz1ArX/i+UhASZNKCkpKKoCgQxGPlv+/Peqkfp9TZLPm5XNExSokvd5SnsOri0dhfX4PWMRauakS70kr+KhvaVTZybR5i/iaGfREGA2EGAmGG3UF66n0kXvpFyeeIJdy0ctLl2iAYfyoAxH31WDr9F+IfjIRJ/CgzCErihQQWw8FCCCmiFxPjhU2O/+wZBh59kBNd7cSvdMK1DWjbHYquscM1NnIdXhL+ZgnCULCJwWATQ74wMYeff5i5jHfbr6Lv7g8x9IMfkUkmSqEw5RDCQRfNjyLjujPib3mbJJ2K//mCoGxoknwuJUkBYALBsPPlpNt7YXjib7zC8JP3Eu1YSKylgUTjJKKuanLXNsJOG9q1drRrneQFANvt5Do9JINNxAJNDIeaGAxFGAhEwOvnIddFHKifi2ap5cQ5Vo41LeD4rkMMv/hz+V1FLDTIq7C13GyazVQmHSedikn6s/MNZqclyADCAKHgfE8yOYrxsV8/z8Dhqxhe1Eh65mRy59eQWBlgaEYzsYvdaLc70K63wQ4BgNICttvIdblJhZqIBcMMhyIMhsJSC/JeP//quYBJnjZ+OXMm6Yl+es9yceyMao6Ot/N+++UM/vDHRSDywkmXmialyXqILAFIFAAQYAgq58N/y1ISLuykkhBxK0AwRzyCCkwXUY6+ksffZvDhHQwtryU9bwLaEivp+Q3EbppB70Pr6J7qJb7BC7sc5K8XZEfbITRBkJXcFjeJcISYMD3BsAIgFCHhDzLoClJZ38bydWvg7ma6nW6Oj3TTM9nH8XNreL+ikQ+6riH+xhuF6xFWUIa/eXG96poNEJR/UIwv0n+zcy4mNsWLM0AwnG+5yZECBwz/8ycZ6vSRXDaJzHo7mdV2EovriB1eTOpnd9A9bwY9FXaS231wqwGAA22HHQQAO+xkt7mJR8LEwhGGw0EGQyEJwFAgBG4P6x0rsFi38L2DF8CjVk7McnFslIvuqT56av2cGFPH+7Ymej/2SensJQYybC36qaJGZMq0oOi0y/nyX7JKJdwI5QQICemwBAAljNdNTjo5yPBHryW5cjzZDXVk2j3k1juIrbMSfXIj2sv7GLpnE71jHPT5fGRv88DNdrQbnLDThbbDiXadHW2nQwKQaApJEIYjIYbCAoAwgzoAd7vmYrF2sWDOKvKPudEedtK3KsCxChfdVQFOWMN01/g4OrqOd7quIjkwUFAFTfcLZhCM36j8gDlU/S82RwbjlZQbttK4mGShliMZLxMrZW3jx37D4J555DZNJLfFQb7DRX6DlWSHk/jntsKzu8l850b6LphGdHKQwQt95Hc70G62od1okyBoQhN2OtB2OgsAJMIChICuBSIcDaF5vXzTO4OzPW2cYW/n69fPhodt8LCPwQ1+usd56KkOc9zazAe2Zt4dXc+bs5YQe/1NQxVUCUQTvyNX8huVmTXCVVVP+i/zCWbJN6KE8r8N5qvsVkU5iaMvMXRTmGznZPJXu8ld7kJrs5JqtRH/x0vh2T3w7B1Ej2ymv9rDcEMz0dVetLusUgO4yQ43OtFucKDd6ITbXGSv9pKaFiLdHCbRFCQaDilfEAyT8Qd4KzCdWt9GLLYOVs5fDg974V6nvB3YEKS7wkd3TZhjjU0ShGPjrLztPZ+hX/yyqAkljtkAQeUHhdqVrg1/cnMk7b0ezZQDIC7S/Leo2xuSn/zgFaK7m8hdVkluu5Pc1Q60y+2kWuuIfboD7Sd74Qe3k/vxLvoumcVQXYgBa5jENgfavga41Yp2swPtFhfscZPf5Sfe4WdgepCoO0S6JUJmehPJ5gjxcBNDwhEHQqQCTVzgXs3png5GuTbx4q5p8JAN7V4n2iNB+peG6R7j43hNgA8aAhyzBjleUcfbzmnEXvuNAUGJTzCiIslwncxA/MlAUMwVAIg4/2SJN0BQVCyipfvfIbq3BW17pTIh19rJX20l01FN9Ik15J4/DN/fBc/dSexTV9Pb4GPI2UyfO0hqhxX2NKDd3gh77OR3eUhuCTIwI0xfQ4T+mhC9tSF66iIMOsIkQmGSzc3EI80kgk0Q9NPhXMRprnYsjR1ct3IBPNKAdrcd7YiT7ENBeloC9FT4OVYb4FiDn+ONyjm/HZ5L8sRx3RoVQ1QDgMJvL8sX/mQgGGpoJFcGAAYY5U0RsbLZBLGHl6JdPQHtJhv56xvRrmtA21ZJ9MAMss8fQvvRXvI/2E3+hQMMXrWCgaleBh3N9EcC5Hbb0Q5Yye2xk9rmJjYnxJC7iWFXM1G7n8FJjQxOdtBb28TxmiaO14XpdYaJBppIhSMQCvKQbwEWdwfnuNqpDW6g54AH7qlDO2yD+10k9/jpqQ7SMznEsTpdExrDvHdODW+vbieb00vhemVVZvS/h/kiECnn3x+1zElJMbkSIBTNT5H5qvoo5D/65dvJbx8Lt9rQbmpAu0GUE2qIX9tI6nu3wnOH0H54J9rTd5L53h76p01jsDFAf2OYgYv95O9zkrrKTXyen1gkQDwcIekLEKu10jNtJr0H7qG3/Rq6xzpl1NRb08QHtYLC9DlC4A/yzeBszvR0Mi7QicW2hb/fPhMeqkM7ZIeDDrQH7QxuCtA92s/xqhBH60McbQhxtC7AW5aJfHDPhxUAUhN0AE4BQpH5xXC8nI//oaUk3PgiVUdXzBcg6PbeVNMxVuzVb5O8YQLc3oB2WyPazfVwUx25KycR/9uNaC8+gPbDA2g/3AsvHCT22GX0VzsZcgborw8wsNRHqjNIakaY9PkR0i1+4vZq+mdMp//+B0keU+ZBfOvwt77PiaUdHDunke4xDo7XNfNBbYRYjY+XnNOY4G1jjL+D0+xbaV2+Ah6xSwC0g060g3ayR1yciPg5VhHkaE2Qd+sDvFPn573JDt4Z5yT68q90BJSQGSa3VPqV5JeEqn8sCIZ5MVMRdWWGijF+kfmZbJLoh2eTv3kC2m4r2h0NaLfWo+2sJLE/QPa5g/Ds3WhPH0T70T60Fw7T27GQgckOBgUAtgDRuQEyl4RJzw+RneUhNjvEwIfuJXHs/VN2wcQVDHztW3xwyWZOTPBxojbMYG2A4/VhfJ6NnO3rYKS3i5rIJroP+OFuG9oBpyTusxG/zssHFQHenxLg3Vofb9X7eVeAcG4d7yzeRFaP6KSPK9MCWS1NlWfJelL6x+QIJzNdp3KnWyglqxX78RNkbhyJdmct+T115HfXw211ZHdMIvHlS9FeeACeOQw/PgTPHCT9/b2caInQX+uh3xmgxxkkudBPfpmf3CV+knOdRJ/+buHz1Tep+o3Z54iV1fKcmL+evnFOBuoCZOoDLPJs4DR/F2O8bVhsbXz56iY40gD7HWj77Wj7bWhHHJxo8fDeKC9Hq3y8U6u04J1aH2+OqKT3818qfLtRrjDzx7D9RearHkP2P+qQxYeWS7/xZSXMl+UFUyk52Uf8fj/smoy2r478XbVoe+rQbpxM8nCI7Av3wXNH0IQGCBBevI/4p6+nu8FLvzNEvytIrydAepkflgXIX+IhtTRItveDwnfIVdZ4N6IusXq3XU/faDv9DRGwhrjUvRqLbwtjfK1YrJ3cuOoiuK8e9lvR9tkkcXcjw1e4eHeMh/em+Hi32s/bAoA6P0crrBydvZxcJq2+Wk/SjO8W/CjmA4YZKoaogmfl/P29y5D2cgDMWW4RgOJKPvsRcredA/vq0fbXKhDurCF7/XiSX9wGLz0Kz91H/rl7JAi88iGG93TQX+VmwBOm3xWmPxgktzoIKwJoi10kLnGTPqpnqHLppqAEgKIW9LRdQ+9YO33WZgnAPsclWDwdjPFu5nRnFxfMXE3+HhscsOogNKLtrSN/t4PjQT/vj/Hy7lQfb9X6easuIP3C0XNqGPzqPxW+v9hL0ENTSaZmjt5LyOjPlfP331zFRorhdE02z2R+VJmhKP05LUPqY3PhrgloB2phfw3sq4Hdk0gdsJF5/l60nz6EJgE4gvbcveRffpjBTUsZrPMy6I0w4Iow0BIgvz6AttoPS50kl7jJvPdW4XtkA+ckAJQGiKuRAFTY6W1sgno/f9M4G4u7XQIw0tPJhEAb7+wVfqBOMV8CUA9HGhnsCHD0XB9HKwO8XRPkjfoQb9eHeP/cOo6u6iw2TEu6aoLhilcqUy5Kv7pVJZpyPv/OVbT3RlOlOMVQqOmLCyhzh8m3vkvmQAXa3dXkD9XA/ipJ+dvGkPzkErRfPoH20wfQfno/PP+A9AXZH99H38wZDFsDDHjD9DvDDM0IoK33o632wTIn6eXeEgA0hN1X0ZeZ+eo56GnfTt9YB70NETL1fr7ZOJMzvR2M8atoyOLYxjeunw73V8PeRrhLpwP1pPe4eL/Kx9GJPt6q8vNGXYi368IcrfLz+kQnw798Rf8i9d1Fs2NIv7hvZr5q5vzBtaLiB5m7WqaOVkH6S22/7Gh9Ywe5u0aQv7cS7e6paAenwP4pZPeMJ/Xdm+Dlj6I9/6BOD8EvHyX1tf0MuMMMuZoYdIfpswWJXRhC2xggv8qHttRJaoWPzLF3Ct9laEAx9yjpcdHbtp2+MXZ668PE6vz8rH46E0QUFOhijL8Ti/UyDrfNhweEkAgNaJAaoO2thXsa6Z3u5egYP29X+Xi9NsDrdcIhB3lrRCUn7lV5QbFGpCyFtPmyn2zuKRvh6b8jN1Dl5KLzKPiCcpUvd76ZGIm/CqHdU0H+vqlo91ah3T0F9laQfsBO7ucfhhcfRXvhYZ0+DK8/SfwjOxmq8TLobmLAFaKnMUDsogDaBn8BgKTQgBIAlBM2Stzlq7d1O32jbXTXhxmqD/JGQwuNnlZG+LsY7evAYt/KhkUr4P4GONCAJkFoRLurHu6uJ9bq5L3RAd6eGuD1GgXAW7VB3hlr5e0F62QHu9wPGAFKKeMNKrYzy/ldsooxrGgrmphfEnaKOr+q9aulQEi//zTpB8bCQ1PgwUq0+yrR7p2CtnckqU9fTP7VT6AJAH7+mLzNi9s3Ps7ATa0MVjoZ8ITodwfotvmJXyIA8JBb7YUlTpIrfKSPv1vC5N+1xNWcED5gjI0TjRH6GoPSFDW5N2Hxd3Kur53TXFuZNnMjuSMOOFhH/oBNhaO6GcreaueDygDvTvTzZrWfN2qDkt4SGlETIPGmYQ51IdByBetgDCSYpb6cyvleWEY3SwBQDDkVs9XEmtGqE48ZyZdS/9TzD5G//yx4eCraQ1PQHphC/r4p5A+eS+rb16C9+rdoLz0Bv3gC7aXH0V5+gvybf01f2xIGq5wMuIP0u0P0OAIklvnIr3OTXeVGW+IgschO8tjbJYz+XUtczbG12+gZ5+SENUJPY4hUQ4hFzrUyFB3l7+AsdxfVoVZOHPbDPfVoB2zkBQB7rdIniOy42+vl6Fhlht6sCfCmAKAuxFvn1tP/2X8sfptssxpWwQjV1dij4GcqGSUj+Jr6A7SgXAMUww0AzKGn7gBNEw3pb3SgfWg02iOVaB/SteDIRDL3TSD74gPwxmfh7c/Ae5+VpL39d2Re/Rv65l/EQINfhqB9rjAnnH6SK33k1woN8KCtcJGdO5X++24iHR+W32WGvpz6v/U9jleH6KkVzZYI3Q1B8nUBuhwrsfi3SRM02tvBCGcrT+86Dx6xwYMOeMAuoyAONcJ9jQzMdfP+uX7em+Ln3akB3q0JcLQ2zLsjGzl+424dAPH7ixFZcfBX+E1TSSIZI5P8PRpg9DgNj36Sycml0HRtkCSzUAVANhsn9almeHQC2kdq0B6rRvtIFTwyjvRnQiRf+xTJH36E6FP7Gbh/B33Xd9Dbupqe+RfT5wzT72miz9NEjyvCCU+A1Bqv1ID8Gjf5lW5Y6iBzYRXDm2czfPUaYlesInrZCoY7V9O/aBPHF6zjg8XrObF0A90NIXqr/XRbmzhmDXGiIYhW4+VG66ICAGOFQ/Z04GlZzZr5l7Bj5SU80jGfr18zk1/e2szwEQ/ZLR5SI32kJ/oYnuSjpzLAsaowx0bZeW/h+kIPWXXOyge9FAiFckTJNIWKksr5X4h+zOXmUptvSshMzRaxMn2/JvP4VPjrKfCpenJPNJA8aCV+ZSND60OcmD+HY74AJxqcnJhq48RUOz01Hnoa/PS5m+j1NtHjbeKEK0J3MERmgzJBubVucqvc5IQWLHWRvaiBzMxaMjOqyc6oIR2qJzrBQf8EB72TnPRUuumzhum1N9Nti3C8MSgByFd7uadhvjRBUgN87YzxtTPCLRxyB5bGTiwNnVjsnfJ527RNLJm1mhusi3iy7iKerZ7JwJRpaJPD5Me46bPPJD04eDIA5ikKfZSlaFWKzD8lAGaHWzQ1JjLyAON5MwDH/5nko6OI3dbA4EYHg7N8si8rmiSDthBD9iCD7ggD3gh93iLDuz1N9ArJd0ck809Ym+gNhMls8JJd4yK9yk16hZvMMieZJW7SoiyxwEVynov0PDfJC9wMVAcZqG2iv7aZ3voWehqa6W1oors+QnddhJ6aMFqln4/WzcPiu4zTfV2M8LVxjq+N0YL8bYwOtDHK18653nZZtDvTuwWLZyuWwBYsoobk72Sap5Vr7St5qno2b48Pkn3FqJCKwa7izhwjEjoZAMV8CU55fchgfjnTCx7elAUXnjeFoNFvfIKeQCV99iBD9jBRT4SoP8KQmFAIi7nNZga9zfQ7I/Tbmui3tdBja6bbEaHbEeKEO8gJf4DeUID+WT4yHR4ybS7SrU4ymx1kW51kN7nIrnOSXusgs8ZJZpWbzBIXyZkCCB+J8wPEzwsSbQkSbQoxFAox5A8z7AqjNQT4jm0GEf8G3L5NVHk3MNqziTNcrTJDFmUKi7cLi7eT033tjPS1U+EX1CY1ZaS/k9P9W7AEtnK6v4uq6mX84J9/pP96VRYxA6CYrEy5UaQTRTlRSzLnBSUAlIaaprlNfXNDSQmirPrZv2cXQ5UNDMkptSY5qxl1RxhyhmVyNeALMxAJMDjdy+BFXqLLgyQ2BUlu8ZG+0k/6Gh+ZHV5yN/rIX+8hf51oXXrIX+2CK13kBV3mIt/lINvpINvhkoDk1jvJrXORWeMmu9JLfrmH7FIP6SVe0pf4Sc8LkJ0dIDMjiDY9RHZ6iMHzwrzb0sQvmlr4Tvh8Ph2Yxd3++VzpW8wi7wq87rWMd27kdFE59QlQtnK6b4vUDGG6xopErmoVDzz5hSIAJhOk+KfKEwV/YArpzf2CEgAMxudNU2HK1KgPNGy/eqw09e/tbGew1s6gJ8KQN8hQc4ChuT6GV3lJbPWRut5LdpcHba8Tbb8L9rrgTgfscsLtLrjFg3aTm/wNbnJi9kcAcI1gvhOucKKJCYpLXdDlQOt0orU6YJMTNjjR1rnIr3bBCg/aEi/aIjfaQje5+T4yF/tJz/GRnukndX6A9HkB8tP80OyBZjdE3BDyQcgv+8c5v59uT4gX7c18wT6De1wL2ORcTcC5jlGuzVg8wiRtwVK1hmt2f7TAA8UI82hjqUM2kwDAcMwFAJRk66QzXDFaTzDKzJIR/Ygl0rETqxYxPLOBeKuL1HU2snts5A840A474JADDthBMP9OB/k9LrTdLrjdCbc44WYH3CxuBRBOuNWuxlB2illQQS64zgNXueEyJ2xzQpcbOjzQ5oZNbljvgTU+WCmKdx5Y5IaFHljgg/k+mOOHWT6Y4YPzvNDiQWvykQ0HSIXCxAIhov4QUW+AuDtA2hVCEy1NZxicEfpszfysYRp/Y53Ddtti3FOXsmrLvhL+K2csQNAF2VS+PyUASRMAxUgnLSucRW3QmX6Kymc2HSP52rdIfOUm0nvdaIcb4YFGOFIPh0WtvRH22kDM9YiCl6B9VjggysBO2O+GPR4yt/jo2RnmtWum8eNLp/P1tvP55JqZfGjpHA4sms+tCxdx5cWLaZ21mNXnL2HF9GUsPX8li89byaKWFcxvWc68yArmh1eyOLycleFlrI8spyOyjKsji7mjeRFHWhby5LR5fL5lFt9tmcHPW6ZxtGkaQ5Fp5ELN4A+DLwjeEHjCZF0RYq4mhlwtckAgZm8iaQujWYNo9UE5hfGSaybHb97D4L98j0zCPPpuzguE1SiW8ZVzTkjpF7mBCYBUaYlBToQZhS4h48rkCPane14l8a07STzcTPqu8eTvrEAT2eShRrQDDXCwHg6JolYNHFHFLW2fnfdv9fDj7RE+03UBB9dczOULF7N41koiLWupC22iwtfOWS4RFrbLrpXF3obF2YnF2YXF0Y7F2Y7F1YnF3cVp7i55a3Hp5FAhpMWhv1+8z3hOvEe8X9x3dzHC3clYdwfV3jZ83s1c7F1Pu3cluz2L+ZR3AT/0zOZt1/nEnC1gbwGrauokrBEGbc0MWJuJNoaJV4sh3wZZH3pn2gKOH3yQ6GvFQV+jSChICHJxdkh3woYJUqqiGu1GvK82tekA6B+Y7n+d+FeuJnV3JfndI9AOTiB/pBbtSJ0c8+BINTwwFe6vY+iAk2duivD4lllctnQh02esoiq4gREi6hBMsnUphrk6GOHp5Bx/B+fKUrGgVioCbYwLtEuq8Lcy1rdZRiTj/OKxDkZ5WjnTuh5LzWosU1dgqVyOZcpSLJMXKxL3q1ZgqV3FafVrOMO6jjOdGznb3SpHFc/2dXKWbwtn+i/FUkKXcY5/qwTnPM862hzLecC6gO/Y5vCedQZYW6A+Qr4uwnBdEz31zZyob+L9yR7eOqeW31YFOLr9NuJvFssmckKkBIBieCqb9mL2EZHhFgAQ6lOc5xT/Rp/7CIn768jvOwvumYh2ZCrcO1UV3j5SLafNfn67nw+3zWLdvKU4mjYwUkrzFiyOLZzp7mSkqMf79Jp8oEhjg61UBFsZJyjQzviQoDZJ4rGKwCbGBloZ7W3FUr8GS91qaqZtY8Hm3Vx52yPceugT3Hb4r7nl4Me5fu8TXH37I3TtvJ91VxxmUfudzFp9E8GF12KbdQUTQh2cbluDpWYFlurlWGpWYalfh8W6kREukQ9sYXRoK2cHOjnNK7SmXQrMGa4O6r3trPKs5Yh9EU/XzSRaex7UtZCtbaK3Nsz7dWHen+rj6Nk1sn9w4hN/WxDecgDMWbIFUdeRABQzXsPWi39j391F+q7TJeNl/fz+qfDwRHhsCr/c7+XurrnMuHCVHHyyWLdicWzlbG8nYwMdjA90MCHYwTjBTMnQNsb6N1ER2My4UCsVoTZJ4jnBcMGg8eEO9VhQaIEAYDOW+tWMsK9l+bYDfPYr3+eDE70FCfv9K08mm2FweJi33n2f5174FV//zjM88emvc+vhj7PmisNEFu2ksmULZ9jWY6leiaV2JWfZNzDKs4lz3Zs51yMStw4svk4s4r5rM9Oda9nrWMqzDbNJVTeRqwrSWxWUM0nvT3bz9plVfHDXIVWj0nJksxlV5jcNbwmySMbnUhIECYSMfhQAiVefInvoLLivGk10jz5UCY9X8cNdftYvWcpovzAll3KaZxujgp1UhATzOhgX7mR8uJMJ4S4mhrsYH+lgfKSdCWHF6PGhVsXwsHhM0cRIhyQBxljxfLCdka5NWKqWsWDzLn703Mmb7syruCfYyF/Ms0ri9xQDiJOWluN4dy/f//GLPPzxL9B27b1UNbVxWu1KRnlbJRCinWmQyJrPEJ01fyejfG0scK7iqbrZJCojxKYGeL8qxLFKH2+NqKb/a9+QX5HPFrWg2CdIYsnrU25mJ6xqfJD47DI4NFradT48hYGHrFy+ejGnO7ZhsV3OqOAWyWxJkU7GR7qY0CRoi6KIftvUyURBAohwO+PCAiQl7eJvQQKEgtkJtmNpWMOE4CY++jdfPCXzMvkc8ed/SvQH31dZub6xwmC8EcUVyDRYYISEUttlWe3kz3/rnfdoXridM+vXMMq9SWbOgvljpY8SPmkzY32tEgCLv43Tfa0scSzl5anTSEz2c2xqgGMjanlv05UKflOdyNwxsxSLb6YIyADg0/PQBAAfqqb7fgczLlyLxXoVI/3bqAgIxgvp7pLSrphvMHyL/Hti89YiAM1dTGrqlPcLoOkkgJhQsPttWKqWM33ZDbzya/MkhFrJ7hP0ffRxuhcvo/ucMRy/fbfOvtIp5kJpwFTDKmeAkYAWASvNcb72raexTF3KuW7B/E2S4dJPSX+1mfEiUBCAeDcx2rsZi68dh2MNv6qcRnRSgN6z6vlgWZeC2JQfGNcgNcBwCGreU78gfcV+eITsnRZ4ooo7Ni/AUn85owJbGRPcytigzrxIl5R+wWjB8CLTT03y9TrjK0K62QoKaqci0CGjl9Vb9xGNxQrXIVY6GaPnsUc4cd759FfWEa+spy/YQqL7hHxeaUFpi9As7WqM0ryfTWyy0Ce9TZoid0zqAcjzL/yK0+pXco5HMbjCJ0xjh/JPRuAQFFFaK6M9mxktum7uzWyvXwQTQ3RbptDzyMfV9Z1UK1LRkN4HMHY4qj6AcsIamdQQsU8thIdO4+bN87HUbmV0oJPRwa1UhBTjxzd1MU4wv2Urk6ZtY1LzNgnCpBZ1W8r0Lsn0scF2xgTaOdffzmgRVvrbGSWGZ6euou2a+2Qqb17Rnz/PB4sW0Te5hpjDR9QXIVpdx8CuOwqvUdKvMvhTmRujVVi6zShOVmyvKrwmgyY3k6tq/zM/eZnTG1ZxjpBw32bGBtpkiFwRFCS0oE0PkxUAo9yb5ST2zoZFaJZKjs7bSCYeV+JhrpbqfkCOqhiNGKN6Jy+iUHCDTLKP9BfX8u7eUbibFmCxtzI62MlYwUhp+7cwoXkbEwTDBQAtRZrQtJXxEeUnhKSPDXYwJtiJpXEdpzWukZGNRUiYsKNTVjN//e1yk7axhBwOPfVpBn1uYnUOYn5RNggT84cYrK1j+KvGuKB5SkEwXjC0OKNTJLWF1tyzlcNURqlA1wbjtz/3/Cuc0biakUID/K2MCbQyJriZCkEB5QMkCccswmRvF76aZbw+ooGeVZeS6Fd7zsx+SAmEuhbpA8wNA9VKE1FRMRETS8rjq0/yxsdXsWj+JZJpFsdmxkot2ML4pm2SJrRsVWCYTJEh9cLMnONpxVK9guVb9/P17z7L8y+9xqFHPiOTqcZpl9HTXQwvxTf3PXyEWMNU0l438VCIeDBELBAk5vUyYLOTeOlF/dXK/Bh2X558UhiUKo4MGiM2xZJwcfhAvqdM+H7ys19xRuNazhHS7dtcBEHkJf5WqRWjxLijfb1MBmdNncev565F+7t/RIiRsCPieAazHyp+f4y0MkHqQswXZGiBJD0bVlYxBR/8gI9/7Ajui7dgqVuFxbaeUcEuKpq2MU5QZKsCRUq+YXJED3YTp9Us58HHnyow2Vi7D32Mb373Wf0v1Wnoe/whorUTyYQ8JJuCxMN+4qEAsaCfmMdDv9tN4jevFd5T3hQxJM0MQMHm677AcMQKgLJyvADghVc53bZOCo4AQIEgmjebOcu1UeYLlspl1EQ6eXDnYeLf+h7oh4QYzDeHnqrrWNqkMQ1i6emxcXxYSRRRWoIWKx4f5LNf+h6rrribCZFOlaVa1zPC06YACW8pSP5Zrs2c3biKz37hWyWf8bvW0Jf/nqijkmzEQ7olQKopQLzJz3DET0yA4PUoDXi5eDaQAKBc0gwym6Gibyh9jfF4CQA/e5XTGwUAbYz0bOZ0IenVovSxlFGutSxq28MnP/dP9J7oKVy74JK4hkLmayo/GFXQYn84jkXYQEMtin1hfRSxYBuL4Zqo7glAzOutd4/x15/7Fh3XP4h/0Q5GCrWsW42ldjWW+rWMsK7hS9/4fsl7svk0meG+ksfEiv/mFYbOc5IN28lM95M5z0eqxU+iOUBcACA0IeBlqLaa2He+XXiftP/y2kxH4JjVXv8tpSMkRQAMk2U2Qc88/wqWcQuleTnbuR7vvGvouv5BPvXUv/DbN0vnlJTAKokvbN47ReYrR1R05heaMmYJUQAYZIwmFnfDiJTaQFY2b5SHKKxUKsUvXn2DT/3jd7jh0CdYsPlOPvnUP5e8JvHuK/TfcBGJF4oz/2KJlH3gyvWkgg2kZ4ZIX+Anc76P5Hl+4i1+ks0BEk1+EuEA8epKBp/4SOG95iioIMWnSMoM5huJZxEElQ8VNUDjjbePctPBj/HJz3+bF3/5W1LJZMn1arm8PJdIvt84bcuYCdXPGSoGOMbfRZ9bKEeLP8wtNMNLmwFQNjOpf3ip2kog5I8tNVOnWvE3nie6sYH4ugayyWjJc9Gv/R2JUDXZ2WEyM4MSgNQFfhLTA8Sn+Um0+EgIIJoCpBtrGLh0q+6b9FKEwXRx+Ib58bIShRkks08oJqT67zlp5aU1MMxXuYapRrwh7YLJCoBcKi4pq2/ckDlIIloEwIh+ygFQ5kkNGakD7oQKiVq2yVeY7K5Z8tQPMBih15Y++A1DXV6YO4L4kUsLzBNLJFqDG+eQmd5IZo6fzIV+MrN8pGb6SMwIkjgvICk+LUCyJUAm6GIg4if+3lH1DXrtXfoqTZzA8iqpaL/+6cbjivnlCVtR20sBKNBJYeTJVJR88zSEknwzANIXiEGtEgBMZsVgqpByBYwu+YVQ1XDWJq0xnLWh5vLCS4tgqeQw/dfPJrdoDNlLxhD/zD0m9kP0e18l1jKZzEUuMnM9pGd7Sc/xkp7lJXmBn+T5QZLn6UBM80sQYjWV9D32SMnnGGv4S1/i+ILFpPuKoa061lIHQb9WcVCgIXQKABHF6MUNEwAyRC0JJQ1zrQMgGV+ckDbbeTkZJ4az0nE5qmhQAQCz1y5ItbgVM6L6PIvxwYaUlEuAoY4F9S5r3A987EbSi88ht6mO9CUjSXzxsZLnowe2k5o+mcwCF5mL3aTnekjN8ZC+0ENypo/kjIAcPZFkgOC10X3xHFIy2yxdmdgwQ3Vuui9ZTjqV0r9HCYSZsSW/WVYB8sRiMX7yoqq+mgFQdl639SYHq0JcfQylJMzUIx6xX0yfDT0lAGIZTqqEqSIvEG+WX6YAMNs9M+ON+0UTVAQg/otvkxAnHbY1km9rILv4XBL/UNx/m01FibbPJHtxI5lLXGQWuEnP85C6yEtyjpfkhT7iMwMkLgiS0IGITxcgBIg2VjP0mU/qDC4ucX9oUxcxy9mcuHO/Yn3hBbJKXzBBBaHRw8+7H32KUXVrePNtZd4Mk6UYL3yjWfJLHatguvlvNQ+q7L4BQDIxfPJknIoIis1jA+WCI/kdEm++X5T+ogMTtZbonQvQWqvIb3OS67Siragg/uRthdekXvsZycWN5Be7yC5ykxUgXOJVIMz1kpztIzFLp5l+khcIEPzEz/ORCNrpm3M+yb6TQ9qBa64lNbqSnvE1DP7g/xYeP9WZQAbzn3n+F5wrkqyp61nStk8PLIp70szCZyYBhNyqmoiqWF93woL5gukKiN8HgK6SxtYas40zGF1+XzLf5HxPkv5nniKzcRza5U7yl9nJbrWhbZzC8A1zyOTV6xL/+nmy8yrJL3eSW+omv8RDdrGHzAIP6Yu9CoQ5HhIXekjM8pIQkZEwRdP9JKb5GKqbRPeBvSUaID65v3ML8Qk1xCZU033xYnJZU8gsoyXTdaORSCQIL7wKS+NaxobE/M8qHv4rNYouCoRmsMqBkD5TmCPhbPUDnZTUl9r93wmAWEbyJb14Rnnsk6W/aAdlOGaKsY3ox9CAvJYlemgh+c7J5K60k73CRvYycdZbPYnlo4k+/RX5uvgXHid78URyq51qEFfsiBETbos8pBe6Sc1zEb/ITWKOW4IQn+klJkHwkxT+IOym393A8M+eK/A3lUzQ23IBsRobMZuHgbGTGPqiaO4Yy9zAUYJww76PYpmyRFZqRcV2pLeVMc4NvPxLveRhYr6ZpD8oREFKE1LJ4n4AQwNOafvNyxzxFNPlYsFKaYSRmCmHrBIyc/ipIg2xkq8/TeqyCWhXN5IXx0xebSd3hZ3cpVa0zVOIXRkh+sunGb7nSnKLqsitcZNZ5SQtQFgmtMAtfUJaOOYLG0idXyd9QnymAiExw0diuk/mCCmPlb5L5pE4+q7crN1z+B4Gq2wMO30MubzEJlfTu2Kt2N53MgjA/332BU6rX6GYLsrNRnOobiUXrryZrNSek88PEvcN3hgZsCH10hwlSqX/9wAgGC1AKAIgw0498SoFQI+GChdS3LRhmKD4l/aT21YB19nkOW/57eKoGjv5K6zy5Nt8ey2JTfWk11vJbXCTXe8ms9YlB2+zK9zklrnILnGQn1VJfO15DF+7jtQFVpKzvcRnCS3wkTxfJGp+EiJEddsYuPAC+latZNDuYdgbZsgbYNDrY9juoqfGSuxXvzYBoFY6laRp6Q5Os26Q9StVPldNl7FiKKByGfd/VC8imqIisx8sAKAfW/AfAkAsFU4J1YnqHl0kZCmyUuKVOTIYbk7pC/1kAYC0wXmSH1oGV09BE2OG11nVWUHb7fLU2/zlVnKXOsh3Osi12sm1OshtcpPd6CK91kV2tYv8Che5i6YwsMpH9J3fMPyxB0hFppCcrXxBfKZfJWkz/MSlJgRIBjwkXU5ioaCazvYHGRLk9dM3fhL9f/Wxcv5z5KOfw1K1UhYQx4f1PndIDRFUBFo5172RCu8GfvuGXv8xJWZmAAyHexL9IebHWCrRUgCorpFuamS6Lkh8qWI4mpn5aameedHSE1I1+B7pO7ywowbtBps891OcdCjP/bzGjnaFTTrl3DYn2U47uQ4buXYnuVYnuU0uMuucaEtqia50EH1NVT2H91xFalo1ybkeErM9UgtUeBqQ4Wn8POGUAySaQ8SaggxHAnJMXRziN+QPMDy1mp6t20oy8DfeOiqbKmLspCIs+huqeycmOcQQgTHJIYa81l9xSH9X6RnUxSTsZADSQhOMLUrm7PffWkYCIUAoL1OI/79F1H4E8+VQl4mUBuj2/40fk95RCTfWot1YT/7GRvI32MjvtJO/ziZPzVIgOMhvc5DtspPtsJNvd5Df7EBbZyO5ZArRp79eYNbQvTeSml5Jcp6H+EUuPUfwktJDU5GsxfVyRbwlQDSizpEbDoUZDgSIW630zJ1bSMyEsLTvOCIn7CoiW6kQpke2WUV/Ww0RyEkOfX7JUrOcr3xThbNGNGSE6irWL0q6+X42UVZ6+H2r6ICVD1DSX3Q6aoS93PQYIagCIPXzL5PdUQG31qHdUk/+lga4yYp2vRVthzBHVrSrbWhX2slf7iC3zUGuSxxHbCPf5iC3eDxDj1xf4jKjn3+S5LQJJBe4SFzkJDHXTWK2V5ojUa6QSdp0lR/EWnxEmwPyOEtJQTH57GQgEiF17Jj8PFGC8c/fzmnOzYwRwwEnTXd0MkFqgRqZOcO2lvDC6/SqqDo3SEY/esgpIh+DjAjI8AMChHI+/5vr3wJA2f6iQ1YOqbSNmf7p35G7YSzarnq0O+rJ31YvgdBuatRBsKFtt8noSLvKIY+lz2+zk99ihc31JNqcJLtLN2cn3v0tsQV2chdZ5Tal2EVulR8IEC4U+YFwyj4Sonw9zU9M7JZpDjHcFCAaChL3uhnyukj+Rh3IJ9a6Kw5haVinAyAGyE4GwJhnklpQtYzHPqHCWaMGpux/nHSB+SYApPn5d0i/sRTzSx1v0fmKurleMZU+o9juU0kNpH/29+RuHkd+TwP5XQ0gALitjvytujnaaUW7zirPgJaHcQttEP8/wFYr2upxxB7bWSL9YgnbPbz/crIXTCG9wC1BSBVAcJOc6SExwytDUwGCACDWEiLaLEyRj4TXzaDTRvzllwufecXNH5bNozGhLjkaI+x/6RhNUQvE1N4I10YaLtjGwMCQrG1IDTD8QMEJC+YXD3ESQJTz9w9ahoMxGKukv2h6VMhqAKCAMkLQ9EtfJHvLOPJ3NqLtaUTbJU4/rFcnZ91Ur86P29kozRHXirB0CtpVVriskfT6CcR/WtrEMVb8tZ8RX1BLboGd9HwnmTl2knNcJC50k5zlITXTQ2qGV4an8WkCAAGEX7Y0kz4XQ3Yr8ZeNc0Hhul0fxVKzUk56FMYqC0NlaqzSmF2VvkBM7U1dxsP6FiURkIgsWJwWrEyR0XLUO2B/zAF+5mSjHIBiY1tJvwGUcGxipV7/Aenbx4M4sOmuevJ31pHfVSu1QPqFm8UhTg2ws4HslZUMfvwq0jcE4NJqkle5SPfphbCyJbSi//6d5KZXkF/oIL40QGZmI6nZblk5Tc1yk75AAaDyA+WUEy1BUgEXA24H8d8azXy46rZHsdStZUywSw4PCIkvjliqST452yr9gBjEamOEfT3++dcpZ66JREw4YnNBrpTK+frvWor5ht1XzQoVfhVNkBEhKQBUvSXd+yap/Q1wVyXsq0O7qwZtdzXaHTUSBO2WOnmIn3b1OKJ3LyCRjpHYfT50jiV5+wyy6dL/cKG4Px6SfceIrfCjNY1i4AsfI7plMbnptWRmu0jPdJOe6SF5vgIhadSMmv2kfDb6p0VI9hSb6BuvOYKlcQOjg2puydAAgwwtUACIscQOuVdBRE7/9B1V+lBaYBQu/xOZbyxjB40x8KQkXkm/yopNDlr3AaJGlHhsNuweC/uq0e6qIn9nFdquarTba8lLEGrJXDWS+DOfke+JfmoHbLKQODBX1eZl5dLodJV22aJf+SQDgdPJ9J8g+u0vkWqaRG6Ok8yFCoSU0IIZ4tTFIMnpooHjI+Wso3/lYrK5YiYwa90uOWwmBs2ECTIzv0hi0lv4gQ41mhhox1K9mmtuf1wHwJwP/CeYnlMtownzu2pFBQcsmaSSseRXbkC7YwTsn4q2rwrtrqloAoTd1eTvqIGbJpPa7SIbU/OdyeOvEb92CumbrGRTwzoAZePmuo/JJobp/5fPSZ0Q0UdswwzyF9STFqZIdNNm+VRuIEgAMM1HqrGSoTtvLTj3/v4has6/XO6Yl07Y5AN+J4lkTYzaODYRWXSjLD/IXrGpHCEcczn//uglbL4R7xrqpRyO6g+XRkG6H3j1G2T2nAMHKyUI7Ksiv3cqeaENu6vhhjEkH1tekpkmX/02g4+uIBvX+7llAKgTC0tP6xL3Yh/eRbZpElnRzpzrJT3bR1L2lIUZ8pE6z0PSNpnY11UFVqynxeyndR3n+tXw2O/WgC45+yRJ3/Mw1t/BxOCWQtOmWMZXQJTz7z9lGVJvePqixy/OExWctjBDmTjJx86D/WPRJAjiCDNdG/ZWk7/xbBJ/d/lJ4aY0NEZpu6xrpeZvioGBsRL/92ukpk8he7GbzEUKhJTeUxbmKB1pYGhmgJSpR3zokb+XNX8xcCzKzxXCxpeN2RtkbCARzBc0LtjFSOcmfvqCOsJMzQSpzLicb/+pq1T6zQAY/WLdH+imIvHMR8jvOQsOTYEDU+FAdeEsOe3ms0j8444yWVZknuMxPtNw8jLxKwMg9c6vSVxiJz/PQWaeSzb3U3PdpC50k57lIWkfR/++YhdOXN/0FTdyhn0TY4Kq/j9OONpT7HMQjlhsMFERkaoViYm/cz2b+OmL6swI0ewRAJTz60+yDBCMMQujMW2eLDDC0Wx6iPijYbR9o9EOV6EdqoaDVXCgEu2WM0l87krTbM/Jg1QG4wuRlulWbaFVK913jMTaENo8q+wfiMM8RGM/faGb7HQrQy1W4m8Vt5H+6Ccvy8nnMYFOBYCUfpMJMmfDBeYrEzROTHr72xkfaOW3b6hsXVQCyvn0J10CgJzp+BUjIsqJsrUEQPQF1I+NvfwUKXmY3xS0e6bC4SlwcDLccTbpv1lV1AATAIKMVN9guiS97KGqr0VNS/d+QGKDOOjVSnaRaOI4yV7kJDvHRdoznoGHDpeYug3X3C03/wnJV9JfWgcyABBFOXNOMDHUKSMhsVHPd/E1JOUmbe2/lvnGErF6Tjc9xmBTgUmSiWpIShiK2Je2oR04A8SBfvdMQRMmae840g94yabU2Tsldl8/IKR8iFb5GVGJNUJexdbU26+QWu0gt9xOVhzwtNBBdr4T7bwqhtZdRNq04+bpZ1/kjLrlcoOIsv3F6Kdg8/Xx+olNXUxqFszXNaMQhq5iyw0Pys8r58t/6VL/oYOgkwGQUZG+2ySb6ifxiRloB0agHalEu2cy2qFJZHePJPlr40RaZZtVw8M08GUuhev9iCIAasW+9w9kF00lt1r0lMV0hYP87DqGL6gn+tLzhdcNR2PMWnOrzH7FVlrVATNFOyYA5E6f5i2yLG3Y/nFyK1W73Gv8L//6k/9e5htL2WmVpJVKqhER6WFp/xvEHnHBgbMkCHmhCXvPIfG51pL/Rko0841JZ2Nwqvwzi4mZ0oHh+0VfeQo5cdLWKhfagnpi509i4Bul+xG++e2nsUxayEixKVuM0esAlGtAORlbq8aGOmRzZkXX3j8P5htLMKfoD4pASFNkyg2S4qyJJ4JKE+6bSv5IJan9o4i9bt47ULbjxehDmKIhtY9LmZ9033vEOzzk19aTE0fYrGggeXElg1/+PyU5hgA3nU6z8drDWKYuZ0xoq54BGxsOS5mugFHgjAmo7VVn2DYy3r/5z4v55mUMqBaLc6Z5Gt0rZ6JHSTy1jNxBAcJktMNjiD4aIp0wDVeZhmkNKiRk8rMUa8UnDj15C+lVU2CzHW3ZRGLr7Az/65eLQa0+KGDUqYQZunjDzWqjhagBFbSgqAnG3xXBIvNPs23682W8ealJiuLIStEpF4e2cuSJP303yQcEAOeg7T+D4f+zQs4jFTDQD8QzgFD3jdMaFZhitii+rpLcphoyy8YwdP1c4r8x9o6JtqPoXJl3+6gaUzQaZc22vXIO6EzXZirCauen2jpb3EIrMuSR4oiCqtV/Gcw3lgFAIZQ0QDAddyn+TR1/gfiXO0jfN5Hs7RZiH59FesB0UHdZKUKCoT8X++k/kVwzmfSSUQxdHmD4iw+TSalNFKJUIXIR5UfUVIc84dz4b1f0Vz3+6a9in32l2s1Tt5YzHBs5y7VJ0un62RFn2tb9ZTHfvAwADDBUQ18NORlLWPPksedIfPsW0h9pJPZwFfHnHyOXGdbNiGC6KomLB7LJIQafuofhVROI75zN8FceJ9l/rGBylBNXdXrVMFKtVbHPQZEqmhl+SZikv//Sd9l640PMWHkz/nnbCV1yPQvb/8wc7R+zzCZAULGWozRCsEKQOAQ2+9a3iP1wP0O//jTZVJ/uxJX2CCnue/bzDH92H8mXf0hGaJXBeKNWJAOAIvMLmXvhb32nj5zwKN1iJa4iEf8PthD/ElZBEwoTFqVUcJxCM7QM2VxCn8IoFuKM/3+78LqcmkcybL1sEZqaI0YR0QBAjJDIQVpT/cpI8Mqv93/sUlJaTLQkE06iogM/+TmTb9E/wxwKqxpVaXfKKB6KHStiitmsGeXX9//VMmfQpya1VVbW2nUqAlCaqCnml5qck8rn+pah8uv432X+X/tKGKzMhdFxEifQFjNjVYcyNpKoKTWjTH5y6bz8+/53/YFLgaAGYCVz9TEYYyxGMV/dV8z+T2qI/4nX/wOm2KJJUOn+0wAAAABJRU5ErkJggg==';
document.querySelectorAll('img[data-logo]').forEach((i) => { i.src = STATION_ICON; });
const shortDate = (s) => { const [, m, d] = s.split('-'); return `${Number(d)} ${MESES[Number(m) - 1]}`; };
const ddmm = (s) => { if (!s) return ''; const [y, m, d] = s.slice(0, 10).split('-'); return d ? `${d}/${m}/${y}` : s; };
const fmtDateTime = (iso) => new Date(iso).toLocaleString('es-PY');
const fmtN = (n, d = 0) => (n == null || !Number.isFinite(Number(n)) ? '—' : Number(n).toLocaleString('es-PY', { minimumFractionDigits: d, maximumFractionDigits: d }));
const fmtKm = (km) => (km < 10 ? km.toFixed(1).replace('.', ',') : String(Math.round(km)));
const daysAgo = (s) => (s ? (Date.now() - new Date(s.slice(0, 10) + 'T12:00:00Z').getTime()) / 86400000 : Infinity);
const isMobile = () => window.matchMedia('(max-width: 1000px)').matches;

// ---------- Pestañas ----------
let calLoaded = false;
const tabButtons = [...document.querySelectorAll('#tabs button')];
tabButtons.forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
function showTab(name) {
  tabButtons.forEach((b) => {
    const on = b.dataset.tab === name;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  });
  document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === name));
  if (name === 'mapa') setTimeout(() => map.invalidateSize(), 50);
  if (name === 'reportar') setTimeout(() => pickMap.invalidateSize(), 50);
  if (name === 'calendario' && !calLoaded) loadCalendar();
  if (name === 'bomberos' && token) loadAdmin();
  if (name === 'departamentos') renderDepartments();
  updateAnim();
}

// ---------- Mapa principal ----------
// Mapa oscuro: OpenStreetMap con un filtro CSS (no necesita clave de API)
const dark = () => L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors', className: 'tiles-dark' });
const osm = () => L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors' });
const esri = () => L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: 'Imágenes © Esri' });
const map = L.map('map', { preferCanvas: true, zoomSnap: 0.25 }).fitBounds(PY_BOUNDS);
const baseDark = dark().addTo(map);
L.control.layers({ Oscuro: baseDark, Calles: osm(), Satélite: esri() }).addTo(map);
// En pantallas táctiles el dedo es impreciso: se agranda el área de toque de cada foco (tolerance, en píxeles)
const TOUCH = window.matchMedia('(pointer: coarse)').matches;
const fireRenderer = L.canvas({ padding: 0.5, tolerance: TOUCH ? 9 : 2 });
const fireLayer = L.layerGroup().addTo(map);
const reportLayer = L.layerGroup().addTo(map);
const stationLayer = L.layerGroup().addTo(map);
let stations = [];
let fires = [];
let reportsCount = null;
let visible = [];
let selected = null;
let selMarker = null;

const legend = L.control({ position: 'bottomleft' });
// Leyenda plegable: en celular empieza cerrada para no tapar focos (antes tapaba ~1 de cada 5 toques)
legend.onAdd = () => {
  const box = el('details', { class: 'map-legend' },
    el('summary', {}, 'Leyenda'),
    el('div', {}, el('i', { class: 'g ring' }), 'MODIS'),
    el('div', {}, el('i', { class: 'g dot' }), 'VIIRS'),
    el('div', {}, el('i', { class: 'g cone' }), 'Hacia dónde lo llevaría el viento'),
    el('div', {}, el('i', { class: 'g rep' }), 'Reporte ciudadano'),
    el('div', {}, el('img', { class: 'g stn', src: STATION_ICON, alt: '' }), 'Cuartel de bomberos'),
    el('div', {}, 'Más grande = más potencia'));
  box.open = !isMobile();
  L.DomEvent.disableClickPropagation(box);
  return box;
};
legend.addTo(map);

// ---------- Cuarteles de bomberos (archivo estático public/bomberos.json) ----------
const rad = (x) => (x * Math.PI) / 180;
function kmBetween(a, b, c, d) {
  const h = Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
function nearestStations(lat, lon, n = 3) {
  return stations.map((s) => ({ s, km: kmBetween(lat, lon, s.lat, s.lon) })).sort((a, b) => a.km - b.km).slice(0, n);
}
const stationName = (s) => `${s.t} de ${s.d}`;
async function loadStations() {
  try {
    stations = await api('/bomberos.json');
    for (const s of stations) {
      s.marker = L.marker([s.lat, s.lon], {
        icon: L.icon({ iconUrl: STATION_ICON, className: 'stn-pin', iconSize: TOUCH ? [20, 20] : [24, 24], iconAnchor: TOUCH ? [10, 10] : [12, 12], popupAnchor: [0, -11] }),
        zIndexOffset: -500, title: stationName(s),
      }).bindPopup(el('div', {}, el('b', {}, 'Cuartel de bomberos'), el('br'), stationName(s), el('br'),
        el('small', {}, `${s.b ? s.b + ', ' : ''}${s.d} (${s.p}). Emergencias: 911 / Bomberos 132.`))).addTo(stationLayer);
    }
    assignDepts();
    renderDepartments();
    if (!selected) renderOverview();
  } catch { /* sin cuarteles */ }
}
$('#fStations').addEventListener('change', (e) => { e.target.checked ? map.addLayer(stationLayer) : map.removeLayer(stationLayer); });
let nearMarked = [];
function markNearStations(list) {
  nearMarked.forEach((s) => s.marker?.getElement()?.classList.remove('near-pin'));
  nearMarked = list.map((n) => n.s);
  nearMarked.forEach((s) => s.marker?.getElement()?.classList.add('near-pin'));
}

// ---------- Focos ----------
async function loadFires() {
  setStatus($('#mapStatus'), 'Consultando NASA FIRMS…', 'loading');
  try {
    const d = await api('/api/fires?days=' + radio('days'));
    fires = d.points.map(([lat, lon, date, time, sensor, sat, conf, frp]) => ({ lat, lon, date, time, sensor, sat, conf, frp }));
    const failed = d.sourcesFailed.length ? ` Sin respuesta de: ${d.sourcesFailed.join(', ')}.` : '';
    $('#mapStatus').dataset.base = `Datos de NASA FIRMS del ${d.start} al ${d.end} (UTC).${failed}`;
    drawFires();
    loadWind(fires);
  } catch (e) {
    setStatus($('#mapStatus'), 'No se pudieron cargar los datos: ' + e.message + ' Probá de nuevo con Actualizar.', 'err');
  }
}
function drawFires() {
  fireLayer.clearLayers();
  const m = $('#fMODIS').checked, v = $('#fVIIRS').checked, hi = $('#fHigh').checked;
  visible = fires.filter((p) => !((p.sensor === 'MODIS' && !m) || (p.sensor === 'VIIRS' && !v) || (hi && p.conf !== 'high')));
  animOrder = [...visible].sort((a, b) => b.frp - a.frp); // la animación prioriza los focos más potentes
  const lightMode = TOUCH && visible.length > 800;
  for (const p of visible) {
    const r = Math.min(9, 3 + Math.sqrt(p.frp) / 2);
    const col = p.sensor === 'MODIS' ? COLOR.modis : COLOR.viirs;
    // Halo suave (no recibe clics) + núcleo. En celular con muchos focos se omite el halo: la mitad de trabajo al mover el mapa.
    if (!lightMode) L.circleMarker([p.lat, p.lon], { renderer: fireRenderer, radius: r * 2.4, stroke: false, fillColor: col, fillOpacity: 0.16, interactive: false }).addTo(fireLayer);
    const core = p.sensor === 'MODIS'
      ? L.circleMarker([p.lat, p.lon], { renderer: fireRenderer, radius: r + 1.5, color: COLOR.modis, weight: 2, fillColor: COLOR.modis, fillOpacity: 0.15 })
      : L.circleMarker([p.lat, p.lon], { renderer: fireRenderer, radius: r, color: '#ffb199', weight: 1, fillColor: COLOR.viirs, fillOpacity: 0.85 });
    core.on('click', (ev) => {
      L.DomEvent.stopPropagation(ev);
      // Celular con el mapa alejado: si bajo el dedo hay un montón de focos, primero se acerca la zona
      if (TOUCH && map.getZoom() < 9) {
        const c = ev.containerPoint;
        const near = visible.filter((q) => map.latLngToContainerPoint([q.lat, q.lon]).distanceTo(c) < 14).length;
        if (near > 3) { map.setView(ev.latlng, Math.min(map.getZoom() + 2.5, 10)); return; }
      }
      openFocus(p);
    });
    core.addTo(fireLayer);
  }
  setStatus($('#mapStatus'), `${$('#mapStatus').dataset.base || ''} ${visible.length} de ${fires.length} detecciones visibles.`);
  assignDepts();
  if (!selected) renderOverview();
  renderDepartments();
  updateAnim();
}

// ---------- Viento actual para todos los focos (Open-Meteo, sin clave) ----------
// Los focos se agrupan en cuadros de 0,5° (~50 km): una sola consulta trae el viento de todos.
const WIND_CELL = 0.5, WIND_TTL = 30 * 60e3;
const windByCell = new Map();
let windLoadedAt = 0;
const cellKey = (lat, lon) => `${Math.floor(lat / WIND_CELL)},${Math.floor(lon / WIND_CELL)}`;
const windAt = (lat, lon) => windByCell.get(cellKey(lat, lon)) || null;
const DIRS = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'];
const compassName = (deg) => DIRS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
async function loadWind(points) {
  if (Date.now() - windLoadedAt > WIND_TTL) windByCell.clear();
  const need = new Map();
  for (const p of points) {
    const k = cellKey(p.lat, p.lon);
    if (!windByCell.has(k) && !need.has(k)) need.set(k, k.split(',').map((n) => (Number(n) + 0.5) * WIND_CELL));
  }
  const keys = [...need.keys()];
  for (let i = 0; i < keys.length; i += 100) {
    const batch = keys.slice(i, i + 100);
    const lat = batch.map((k) => need.get(k)[0].toFixed(2)).join(','), lon = batch.map((k) => need.get(k)[1].toFixed(2)).join(',');
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=kmh&timezone=UTC`);
      if (!r.ok) throw new Error('Open-Meteo ' + r.status);
      let j = await r.json();
      if (!Array.isArray(j)) j = [j];
      batch.forEach((k, n) => { const c = j[n] && j[n].current; if (c && c.wind_direction_10m != null) windByCell.set(k, { kmh: c.wind_speed_10m, from: c.wind_direction_10m, time: c.time }); });
      windLoadedAt = Date.now();
    } catch { /* sin viento: la animación muestra solo las llamas */ }
  }
  for (const p of fires) p.wind = windAt(p.lat, p.lon);
  if (selected) { const chip = $('#windNow'); if (chip) chip.replaceWith(windNowChip(selected)); }
  updateAnim(true);
}
function windNowChip(p) {
  const w = p.wind;
  return el('span', { id: 'windNow', class: 'wind-now' }, w
    ? `Viento ahora: ${fmtN(w.kmh)} km/h hacia el ${compassName((w.from + 180) % 360)}`
    : 'Viento ahora: sin dato');
}

// ---------- Animación: llama en cada foco + estela hacia donde lo llevaría el viento ----------
// Se dibuja en un canvas encima del mapa (no recibe clics: los focos se siguen pudiendo tocar).
const animCanvas = el('canvas', { class: 'fire-anim', 'aria-hidden': 'true' });
map.getContainer().append(animCanvas);
const actx = animCanvas.getContext('2d');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let dpr = 1, animRaf = 0, lastFrame = 0, frameGap = 33, pausedUntil = 0, animOrder = [];
// Presupuesto: cuántos focos se animan a la vez (los más potentes que estén a la vista).
// Los demás siguen en el mapa como puntos y se pueden tocar igual.
const ANIM_MAX = TOUCH ? 180 : 700;

// Dibujos base: se generan una vez y después solo se copian, rotados y escalados
function sprite(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
const coneSprite = sprite(160, 80, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(255,170,60,0.75)'); g.addColorStop(0.45, 'rgba(255,100,40,0.35)'); g.addColorStop(1, 'rgba(255,60,30,0)');
  c.fillStyle = g;
  c.beginPath(); c.moveTo(0, h / 2 - 4); c.lineTo(w * 0.92, 6); c.quadraticCurveTo(w, h / 2, w * 0.92, h - 6); c.lineTo(0, h / 2 + 4); c.closePath(); c.fill();
});
const flameSprite = sprite(40, 60, (c, w, h) => {
  const flame = (sx, sy, col) => {
    c.save(); c.translate(w / 2, h); c.scale(sx, sy);
    c.beginPath(); c.moveTo(0, -56); c.bezierCurveTo(10, -38, 18, -24, 16, -12); c.bezierCurveTo(14, -2, 6, 2, 0, 2);
    c.bezierCurveTo(-6, 2, -14, -2, -16, -12); c.bezierCurveTo(-18, -24, -10, -38, 0, -56); c.closePath();
    c.fillStyle = col; c.fill(); c.restore();
  };
  const outer = c.createLinearGradient(0, h, 0, 0); outer.addColorStop(0, '#ff3b2f'); outer.addColorStop(0.6, '#ff7a1a'); outer.addColorStop(1, 'rgba(255,170,40,0.2)');
  c.shadowColor = 'rgba(255,90,30,0.9)'; c.shadowBlur = 8;
  flame(1, 1, outer);
  c.shadowBlur = 0;
  const inner = c.createLinearGradient(0, h, 0, h * 0.35); inner.addColorStop(0, '#fff3b0'); inner.addColorStop(1, 'rgba(255,200,60,0.1)');
  flame(0.5, 0.55, inner);
});
const emberSprite = sprite(16, 16, (c, w) => {
  const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  g.addColorStop(0, 'rgba(255,240,180,1)'); g.addColorStop(0.4, 'rgba(255,150,40,0.9)'); g.addColorStop(1, 'rgba(255,80,20,0)');
  c.fillStyle = g; c.fillRect(0, 0, w, w);
});
const seedOf = (p) => { const s = Math.sin(p.lat * 12.9898 + p.lon * 78.233) * 43758.5453; return s - Math.floor(s); };

function sizeAnim() {
  const s = map.getSize();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  animCanvas.width = Math.round(s.x * dpr); animCanvas.height = Math.round(s.y * dpr);
  animCanvas.style.width = s.x + 'px'; animCanvas.style.height = s.y + 'px';
}
function drawAnim(t) {
  actx.setTransform(1, 0, 0, 1, 0, 0);
  actx.clearRect(0, 0, animCanvas.width, animCanvas.height);
  if (!$('#fAnim').checked) return;
  const size = map.getSize();
  const zf = Math.min(2.4, Math.max(0.55, 2 ** ((map.getZoom() - 7) * 0.6)));
  const zoom = map.getZoom();
  const dense = visible.length > 400 && zoom < 7;
  // Posiciones: se proyectan una vez por nivel de zoom y en cada cuadro solo se suma el desplazamiento del mapa
  const off = map.containerPointToLayerPoint([0, 0]);
  const po = map.getPixelOrigin(), key = `${zoom}|${po.x}|${po.y}`; // cambia con el zoom o si el mapa salta lejos
  const pts = [];
  for (const p of animOrder) {
    if (p._z !== key) { p._lp = map.latLngToLayerPoint([p.lat, p.lon]); p._z = key; }
    const pt = { x: p._lp.x - off.x, y: p._lp.y - off.y };
    if (pt.x < -120 || pt.y < -120 || pt.x > size.x + 120 || pt.y > size.y + 120) continue;
    pts.push([p, pt, p.seed ??= seedOf(p)]);
    if (pts.length >= ANIM_MAX) break;
  }
  // 1) Estela del viento y brasas que avanzan en esa dirección
  for (const [p, pt, seed] of pts) {
    const w = p.wind;
    if (!w || w.kmh < 2) continue;
    const ang = rad((w.from + 180) % 360) - Math.PI / 2; // rumbo (0 = norte) a ángulo del canvas (0 = este)
    const L = Math.min(95, 18 + w.kmh * 1.7) * zf * (0.85 + Math.min(0.5, Math.sqrt(p.frp) / 20));
    const cos = Math.cos(ang), sin = Math.sin(ang);
    actx.setTransform(dpr * cos, dpr * sin, -dpr * sin, dpr * cos, dpr * pt.x, dpr * pt.y);
    actx.globalAlpha = (dense ? 0.45 : 0.7) * (0.75 + 0.25 * Math.sin(t * 2.2 + seed * 6.3));
    actx.drawImage(coneSprite, 0, -L * 0.26, L, L * 0.52);
    if (!dense) {
      // Flecha en la punta: marca hacia dónde va
      const a = Math.max(3.5, L * 0.09), bob = Math.sin(t * 3 + seed * 5) * a * 0.4;
      actx.globalAlpha = 0.9;
      actx.strokeStyle = '#ffc070'; actx.lineWidth = Math.max(1.5, a * 0.45); actx.lineCap = 'round'; actx.lineJoin = 'round';
      actx.beginPath(); actx.moveTo(L - a * 1.6 + bob, -a); actx.lineTo(L + bob, 0); actx.lineTo(L - a * 1.6 + bob, a); actx.stroke();
    }
    const n = dense ? 2 : 3, speed = 0.22 + w.kmh / 70;
    for (let k = 0; k < n; k++) {
      const ph = (t * speed + seed + k / n) % 1;
      const x = ph * L, y = Math.sin(ph * 7 + seed * 20 + k) * L * 0.1 * ph;
      const s = (3 + 4 * (1 - ph)) * Math.min(1.5, Math.max(0.8, zf));
      actx.globalAlpha = (1 - ph) * 0.95;
      actx.drawImage(emberSprite, x - s / 2, y - s / 2, s, s);
    }
  }
  // 2) Llamas encima, con un parpadeo distinto en cada foco
  for (const [p, pt, seed] of pts) {
    const sz = (0.75 + Math.min(1.1, Math.sqrt(p.frp) / 9)) * zf;
    const fl = 1 + 0.13 * Math.sin(t * 11 + seed * 40) + 0.07 * Math.sin(t * 23 + seed * 17);
    const sway = 0.06 * Math.sin(t * 5 + seed * 9);
    const fw = 10 * sz, fh = 15 * sz * fl;
    actx.setTransform(dpr, 0, dpr * sway, dpr, dpr * pt.x, dpr * pt.y);
    actx.globalAlpha = dense ? 0.85 : 0.95;
    actx.drawImage(flameSprite, -fw / 2, -fh * 0.8, fw, fh);
  }
  actx.globalAlpha = 1;
}
function animLoop(ts) {
  animRaf = requestAnimationFrame(animLoop);
  // Mientras el dedo toca la pantalla no se dibuja: el toque sobre el foco se atiende al instante
  if (ts < pausedUntil || ts - lastFrame < frameGap) return;
  lastFrame = ts;
  const c0 = performance.now();
  drawAnim(ts / 1000);
  // Ritmo adaptable: si un cuadro tarda mucho (celular lento), se dibuja menos seguido (de 30 a ~8 por segundo)
  frameGap = Math.min(120, Math.max(33, (performance.now() - c0) * 4));
}
map.getContainer().addEventListener('touchstart', () => { pausedUntil = Infinity; }, { passive: true });
const resumeAnim = () => { pausedUntil = performance.now() + 350; };
map.getContainer().addEventListener('touchend', resumeAnim, { passive: true });
map.getContainer().addEventListener('touchcancel', resumeAnim, { passive: true });
function updateAnim(redraw = false) {
  const on = $('#fAnim').checked && $('#mapa').classList.contains('active') && !document.hidden;
  if (on && !reducedMotion.matches) { if (!animRaf) animRaf = requestAnimationFrame(animLoop); return; }
  if (animRaf) { cancelAnimationFrame(animRaf); animRaf = 0; }
  if (on || redraw || !$('#fAnim').checked) drawAnim(0); // sin movimiento: dibujo fijo
}
sizeAnim();
map.on('resize', () => { sizeAnim(); updateAnim(true); });
map.on('zoomstart', () => { animCanvas.style.opacity = '0'; });
// Al arrastrar con el dedo la animación está en pausa: se oculta y se redibuja al soltar
map.on('dragstart', () => { if (!animRaf || pausedUntil > performance.now()) animCanvas.style.opacity = '0'; });
map.on('dragend', () => { animCanvas.style.opacity = ''; drawAnim(performance.now() / 1000); });
map.on('zoomend', () => { animCanvas.style.opacity = ''; updateAnim(true); });
map.on('moveend', () => { if (!animRaf) updateAnim(true); });
$('#fAnim').addEventListener('change', () => updateAnim(true));
document.addEventListener('visibilitychange', () => updateAnim());
reducedMotion.addEventListener?.('change', () => updateAnim(true));
map.attributionControl.addAttribution('Viento: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a>');
['fMODIS', 'fVIIRS', 'fHigh'].forEach((id) => $('#' + id).addEventListener('change', drawFires));
document.querySelectorAll('input[name="days"]').forEach((i) => i.addEventListener('change', loadFires));
$('#btnReload').addEventListener('click', () => { loadFires(); loadPublicReports(); });
$('#btnPY').addEventListener('click', () => goToDept(''));
$('#btnReportar').addEventListener('click', () => { showTab('reportar'); window.scrollTo({ top: 0 }); });
$('#btnLoc').addEventListener('click', () => {
  if (!navigator.geolocation) return alert('Tu navegador no permite usar la ubicación.');
  navigator.geolocation.getCurrentPosition((p) => map.setView([p.coords.latitude, p.coords.longitude], 11), () => alert('No se pudo obtener tu ubicación. Revisá el permiso del navegador.'));
});

// ---------- Reportes ciudadanos: marcador morado + ventana de detalle ----------
const repIcon = L.divIcon({ className: 'rep-pin', iconSize: [26, 26], iconAnchor: [13, 13] });
const REP_STATUS = { pendiente: 'Pendiente de revisión', verificado: 'Verificado por Bomberos', atendido: 'Atendido', descartado: 'Descartado' };
let repModal = null, repLastFocus = null;

function repKey(e) { if (e.key === 'Escape') closeReport(); }
function closeReport() {
  if (!repModal) return;
  repModal.remove(); repModal = null;
  document.removeEventListener('keydown', repKey);
  if (repLastFocus && repLastFocus.focus) repLastFocus.focus();
}
function openReport(r) {
  closeReport();
  repLastFocus = document.activeElement;
  const status = r.status || 'pendiente';
  const field = (label, value) => el('div', { class: 'rm-field' }, el('span', {}, label), el('p', {}, value || '—'));
  // El contacto es privado: solo se ve con la sesión de Bomberos iniciada
  const contactP = el('p', {}, token ? 'Cargando…' : 'Solo lo ve Bomberos');
  if (token) {
    adminApi('/api/admin/reports')
      .then((list) => { const m = list.find((x) => String(x.id) === String(r.id)); contactP.textContent = m && m.contact ? m.contact : 'No indicó'; })
      .catch(() => { contactP.textContent = 'Solo lo ve Bomberos'; });
  }
  const closeBtn = el('button', { class: 'rm-x', type: 'button', 'aria-label': 'Cerrar', onclick: closeReport }, '×');
  const dialog = el('div', { class: 'rm', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'rmTitle' },
    el('header', { class: 'rm-head' },
      el('div', {}, el('small', {}, 'Reporte ciudadano'), el('h3', { id: 'rmTitle' }, 'Detalle del reporte')),
      closeBtn),
    el('div', { class: 'rm-body' },
      el('span', { class: 'rm-pill ' + status }, REP_STATUS[status] || status),
      el('div', { class: 'rm-field' }, el('span', { class: 'rm-lbl' }, 'Descripción'), el('p', { class: 'rm-desc' }, r.description)),
      el('div', { class: 'rm-grid' }, field('Nombre', r.name), field('Fecha y hora', r.createdAt ? fmtDateTime(r.createdAt) : null)),
      el('div', { class: 'rm-field' }, el('span', {}, 'Contacto'), contactP)),
    el('footer', { class: 'rm-foot' },
      el('span', {}, 'Código: ' + r.id),
      el('button', { class: 'rm-btn', type: 'button', onclick: closeReport }, 'Volver al mapa')));
  repModal = el('div', { class: 'rm-overlay', onclick: (e) => { if (e.target === e.currentTarget) closeReport(); } }, dialog);
  document.body.append(repModal);
  document.addEventListener('keydown', repKey);
  closeBtn.focus();
}

async function loadPublicReports() {
  try {
    const list = await api('/api/reports');
    reportsCount = list.length;
    reportsList = list;
    reportLayer.clearLayers();
    for (const r of list) {
      L.marker([r.lat, r.lon], { icon: repIcon, zIndexOffset: 800, title: 'Reporte ciudadano' })
        .on('click', () => openReport(r))
        .addTo(reportLayer);
    }
    if (!selected) renderOverview();
  } catch { /* sin reportes */ }
}
$('#fReports').addEventListener('change', (e) => { e.target.checked ? map.addLayer(reportLayer) : map.removeLayer(reportLayer); });

// ---------- Íconos (trazos SVG simples) ----------
const ICONS = {
  viento: ['M3 8h11a3 3 0 1 0-3-3', 'M3 12h15a3 3 0 1 1-3 3', 'M3 16h8'],
  aire: ['M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z', 'M9.5 15.5l5-5', 'M10 11h.01', 'M14 15h.01'],
  temp: ['M10 14V5a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0z', 'M12 9v7'],
  suelo: ['M3 14h18', 'M3 18h18', 'M5 10l3-3 3 3 3-3 3 3 2-2'],
  lluvia: ['M7 15a4 4 0 1 1 .6-8A5 5 0 0 1 17 8a3.5 3.5 0 0 1 0 7z', 'M8 18l-1 3', 'M12 18l-1 3', 'M16 18l-1 3'],
  veg: ['M5 19c0-8 6-14 14-14 0 8-6 14-14 14z', 'M5 19l7-7'],
  pendiente: ['M3 19h18V7z', 'M9 15l4-3'],
  combustible: ['M12 3l5 7h-3l4 6H6l4-6H7z', 'M12 16v5'],
  pin: ['M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z', 'M12 10h.01'],
};
const icon = (name) => svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, (ICONS[name] || ICONS.pin).map((d) => svg('path', { d })));
const FACTOR_TEXT = {
  viento: ['Viento fuerte', 'Poco viento'], aire: ['Aire seco', 'Aire húmedo'], temp: ['Temperatura alta', 'Temperatura baja'],
  suelo: ['Suelo seco', 'Suelo húmedo'], lluvia: ['Falta de lluvia', 'Lluvia reciente'], veg: ['Vegetación seca', 'Vegetación húmeda'],
  pendiente: ['Pendiente', 'Terreno plano'], combustible: ['Vegetación para quemar', 'Poca vegetación'],
};

// ---------- Datos del resumen: se leen de las filas por fuente que arma el servidor ----------
const num = (s) => { const m = s == null ? null : String(s).match(/-?\d+(?:[.,]\d+)?/); return m ? parseFloat(m[0].replace(',', '.')) : null; };
function metricsOf(s) {
  const rows = s.rows || [];
  const row = (prefix) => { const r = rows.find((x) => x.label.startsWith(prefix)); return r && r.value && r.value !== 'sin dato' ? r : null; };
  const item = (label) => (s.items || []).find((i) => i.label === label);
  const m = {};
  const w = row('Viento (');
  const wm = w && w.value.match(/([\d.,]+) km\/h desde el (\S+) \(([\d.,]+)°\)/);
  if (wm) m.wind = { kmh: num(wm[1]), from: wm[2], fromDeg: num(wm[3]), toward: s.windToward, date: w.date };
  const t = row('Temperatura del aire');
  if (t) m.air = { tC: num(t.value), rh: num((t.value.match(/humedad relativa ([\d.,]+)/) || [])[1]), date: t.date };
  const ss = row('Humedad superficial'), sr = row('Humedad de raíces');
  if (ss || sr) {
    const it = item('Suelo (humedad)');
    m.soil = {
      surface: ss ? num(ss.value) : null, root: sr ? num(sr.value) : null,
      pctl: sr ? num((sr.value.match(/percentil ([\d.,]+)/) || [])[1]) : null,
      rel: it ? (it.text.match(/(más seca de lo habitual|más húmeda de lo habitual|dentro de lo habitual)/) || [])[1] : null,
      date: (ss || sr).date,
    };
  }
  const ch = row('Lluvia diaria'), im = row('Precipitación de 7 días');
  if (ch || im) m.rain = {
    mm30: ch ? num(ch.value) : null, dryDays: ch ? num((ch.value.match(/, (\d+) días? secos/) || [])[1]) : null, date30: ch && ch.date,
    mm7: im ? num(im.value) : null, date7: im && im.date,
  };
  const cov = row('Cobertura del terreno'), veg = row('Vegetación (');
  if (cov || veg) {
    const nd = veg && veg.value.match(/NDVI (-?[\d.,]+) \(([^)]+)\)/), nm = veg && veg.value.match(/NDMI (-?[\d.,]+) \(([^)]+)\)/);
    m.veg = { cover: cov && cov.value, ndvi: nd && nd[1], ndviTxt: nd && nd[2], ndmi: nm && nm[1], ndmiTxt: nm && nm[2], date: veg && veg.date };
  }
  const sl = row('Pendiente'), ele = row('Elevación'), tx = item('Suelo (tipo)'), deg = item('Suelo (estado)'), radar = row('Cambio en la superficie');
  m.terrain = {
    slope: sl && num(sl.value), elev: ele && num(ele.value),
    texture: tx && (tx.text.match(/Textura ([^(]+?) \(/) || [])[1], textureNote: tx && (tx.text.split(': ')[1] || '').replace(/\.$/, ''),
    degraded: deg && deg.text, radar: radar && radar.value,
  };
  return m;
}

// ---------- Panel de análisis del foco ----------
const panel = $('#focusPanel');
const card = (cls, ...kids) => el('div', { class: 'card fp-card ' + cls }, ...kids);
const title = (text, small) => el('h3', { class: 'fp-title' }, text, small ? el('small', {}, small) : null);

function renderOverview() {
  if (selected) return;
  assignDepts();
  const dep = selectedDept;
  // Con un departamento elegido, los números y la lista son solo de ese departamento
  const base = dep ? visible.filter((p) => p.dept === dep.id) : visible;
  const modis = base.filter((p) => p.sensor === 'MODIS').length;
  const high = base.filter((p) => p.conf === 'high').length;
  const maxFrp = base.reduce((a, p) => Math.max(a, p.frp), 0);
  const reps = dep ? reportsList.filter((r) => deptOf(r.lat, r.lon)?.id === dep.id).length : reportsCount;
  const kpi = (label, value, cls = '', glyph = null) => el('div', { class: 'card kpi ' + cls }, el('span', {}, glyph, label), el('b', {}, value));
  const top = [...base].sort((a, b) => b.frp - a.frp).slice(0, 6);
  // .filter(Boolean): sin departamento elegido, la tarjeta del departamento no existe (si no, aparecería el texto "null")
  panel.replaceChildren(...[
    dep ? card('fp-full dept-head', el('div', { class: 'fhead' },
      el('h3', {}, dep.name),
      el('p', { class: 'facts' },
        el('span', {}, dep.num ? `Departamento ${deptNum(dep)}` : 'Distrito Capital'),
        dep.num ? el('span', {}, `Capital: ${dep.capital}`) : null,
        el('span', {}, `${stationsIn(dep)} ${stationsIn(dep) === 1 ? 'cuartel' : 'cuarteles'}`)),
      el('button', { class: 'x', type: 'button', 'aria-label': 'Volver a todo Paraguay', onclick: () => goToDept('') }, '×'),
      el('p', { class: 'fhead-note' }, 'Los números de abajo son solo de este departamento. El mapa sigue mostrando los focos vecinos.'))) : null,
    el('div', { class: 'fp-full kpis' },
      kpi('Detecciones', fmtN(base.length), 'hot'),
      kpi('MODIS', fmtN(modis), '', el('i', { class: 'g ring' })),
      kpi('VIIRS', fmtN(base.length - modis), '', el('i', { class: 'g dot' })),
      kpi('Confianza alta', fmtN(high)),
      kpi('Potencia máx.', `${fmtN(maxFrp)} MW`, 'hot'),
      kpi('Reportes', reps == null ? '—' : fmtN(reps), 'cy', el('i', { class: 'g rep' }))),
    card('fp-full hint', icon('pin'), el('p', {}, el('b', {}, 'Tocá un foco en el mapa '), 'para ver su análisis: puntaje de propagación, viento, aire, suelo, lluvia, vegetación y los cuarteles de bomberos más cercanos.')),
    card('fp-full', title(dep ? `Focos más intensos en ${dep.name}` : 'Focos más intensos', 'por potencia radiativa (FRP)'),
      top.length ? el('ul', { class: 'toplist' }, top.map((p) => {
        const n = nearestStations(p.lat, p.lon, 1)[0];
        return el('li', {}, el('button', { type: 'button', onclick: () => openFocus(p, true) },
          el('i', { class: 'g ' + (p.sensor === 'MODIS' ? 'ring' : 'dot') }),
          el('span', { class: 'where' }, `${p.sensor} · ${ddmm(p.date)} ${p.time.slice(0, 2)}:${p.time.slice(2)} UTC`,
            el('small', {}, n ? `Cuartel más cercano: ${n.s.d} (${n.s.p}), a ${fmtKm(n.km)} km` : `${p.lat.toFixed(3)}, ${p.lon.toFixed(3)}`)),
          el('span', { class: 'frp' }, `${fmtN(p.frp)} MW`)));
      })) : el('p', { class: 'fp-empty' }, !fires.length ? 'Cargando detecciones…' : dep ? `No hay focos en ${dep.name} con estos filtros.` : 'Ningún foco coincide con los filtros.'))].filter(Boolean));
}

function closeFocus() {
  selected = null;
  if (selMarker) { map.removeLayer(selMarker); selMarker = null; }
  markNearStations([]);
  renderOverview();
}

const focusCache = new Map();
let focusSeq = 0;
function openFocus(p, pan = false) {
  selected = p;
  const seq = ++focusSeq;
  if (selMarker) map.removeLayer(selMarker);
  selMarker = L.marker([p.lat, p.lon], { icon: L.divIcon({ className: 'sel-ring', iconSize: [34, 34] }), interactive: false, zIndexOffset: 1000 }).addTo(map);
  if (pan) map.setView([p.lat, p.lon], Math.max(map.getZoom(), 9));
  const near = nearestStations(p.lat, p.lon, 3);
  markNearStations(near);

  const head = focusHeader(p);
  const stationsCard = nearCard(near);
  const skel = (cls, t) => card(cls + ' skel', title(t), el('div', { class: 'bone big' }), el('div', { class: 'bone w60' }), el('div', { class: 'bone w40' }));
  panel.replaceChildren(head,
    el('div', { class: 'card fp-card fp-tall skel' }, el('p', { class: 'status loading' }, 'Analizando el área con datos de NASA, Copernicus y ECMWF. Puede tardar hasta un minuto.'), el('div', { class: 'bone big' })),
    skel('', '1. Viento'), skel('', '2. Aire'), skel('', '3. Suelo'), skel('', '4. Lluvia'), stationsCard);
  // El análisis está debajo del mapa (en computadora y en celular): se baja hasta él
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const key = `${p.lat},${p.lon}`;
  if (!focusCache.has(key)) focusCache.set(key, api(`/api/focus?lat=${p.lat}&lon=${p.lon}`).catch((e) => { focusCache.delete(key); throw e; }));
  focusCache.get(key).then((d) => {
    if (seq !== focusSeq) return;
    renderFocus(p, d.summary, head, stationsCard);
  }).catch((e) => {
    if (seq !== focusSeq) return;
    panel.replaceChildren(head,
      card('fp-full', title('Resumen del área no disponible'), el('p', { class: 'status err' }, e.message),
        el('button', { class: 'btn primary', type: 'button', onclick: () => openFocus(p) }, 'Reintentar')),
      stationsCard);
  });
}

function focusHeader(p) {
  const hh = `${p.time.slice(0, 2)}:${p.time.slice(2)}`;
  return card('fp-full', el('div', { class: 'fhead' },
    el('h3', {}, el('i', { class: 'g ' + (p.sensor === 'MODIS' ? 'ring' : 'dot') }), `Detección ${p.sensor}`),
    el('p', { class: 'facts' },
      el('span', {}, `${ddmm(p.date)} ${hh} UTC`), el('span', {}, `Confianza ${CONF[p.conf]}`),
      el('span', {}, `${fmtN(p.frp, p.frp < 10 ? 1 : 0)} MW`), el('span', {}, p.sat), el('span', {}, `${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}`),
      windNowChip(p)),
    el('button', { class: 'btn link to-map', type: 'button', onclick: () => $('.mapbox').scrollIntoView({ behavior: 'smooth', block: 'center' }) }, '↑ Ver en el mapa'),
    el('button', { class: 'x', type: 'button', 'aria-label': 'Cerrar el análisis del foco', onclick: closeFocus }, '×'),
    el('p', { class: 'fhead-note' }, 'Un foco satelital no confirma un incendio.')));
}

function nearCard(near) {
  return card('', title('Cuarteles cercanos', 'en línea recta'),
    near.length ? el('ul', { class: 'stations' }, near.map((n) => el('li', {}, el('button', {
      type: 'button', onclick: () => { map.setView([n.s.lat, n.s.lon], Math.max(map.getZoom(), 12)); n.s.marker?.openPopup(); if (isMobile()) $('#map').scrollIntoView({ behavior: 'smooth', block: 'center' }); },
    }, el('img', { src: STATION_ICON, alt: '' }), el('span', {}, el('span', { class: 'name' }, stationName(n.s)), el('small', {}, `${n.s.d}, ${n.s.p}`)),
      el('span', { class: 'km' }, `${fmtKm(n.km)} km`)))))
      : el('p', { class: 'fp-empty' }, 'No se pudo cargar la lista de cuarteles.'),
    el('p', { class: 'fp-sub' }, 'Emergencias: 911 / Bomberos 132.'));
}

const LEVEL_COLOR = { bajo: '#34d399', moderado: '#f5a524', alto: '#ff6b2c', 'muy alto': '#ff3b2f' };
function gaugeCard(s) {
  const R = 80, C = 2 * Math.PI * R, score = s.score ?? 0;
  const arc = svg('circle', { class: 'arc', cx: 100, cy: 100, r: R, fill: 'none', stroke: 'url(#gGrad)', 'stroke-width': 22, 'stroke-linecap': 'round', 'stroke-dasharray': C, 'stroke-dashoffset': C * (1 - score / 100), transform: 'rotate(-90 100 100)', filter: 'url(#gGlow)', style: `--from:${C}` });
  const g = svg('svg', { viewBox: '0 0 200 200', role: 'img', 'aria-label': s.score == null ? 'Sin datos suficientes' : `Puntaje de propagación ${s.score} de 100, ${s.level}` },
    svg('defs', {},
      svg('linearGradient', { id: 'gGrad', x1: 0, y1: 0, x2: 0, y2: 1 }, svg('stop', { offset: 0, 'stop-color': '#ff9a2e' }), svg('stop', { offset: 1, 'stop-color': '#ff3b2f' })),
      svg('filter', { id: 'gGlow', x: '-30%', y: '-30%', width: '160%', height: '160%' }, svg('feGaussianBlur', { stdDeviation: 4, result: 'b' }), svg('feMerge', {}, svg('feMergeNode', { in: 'b' }), svg('feMergeNode', { in: 'SourceGraphic' })))),
    svg('circle', { cx: 100, cy: 100, r: R, fill: 'none', stroke: '#4a0f17', 'stroke-width': 22 }),
    s.score != null ? arc : null,
    svg('text', { class: 'num', x: 100, y: 112, 'text-anchor': 'middle' }, s.score == null ? '—' : String(s.score)),
    svg('text', { class: 'lvl', x: 100, y: 142, 'text-anchor': 'middle', fill: LEVEL_COLOR[s.level] || '#9cb3bf' }, s.level ? s.level.toUpperCase() : 'SIN DATOS'));
  return el('div', { class: 'card fp-card fp-tall gauge' },
    el('div', {}, el('h4', {}, 'Puntaje de Propagación'), g,
      el('p', { class: 'meta' }, s.score == null ? 'No hay datos suficientes.' : `${s.factorsUsed} de 8 factores · estimación orientativa`)));
}

function windCard(w) {
  if (!w) return card('', title('1. Viento'), el('p', { class: 'fp-empty' }, 'Sin dato de viento para este punto.'));
  const toward = (w.fromDeg + 180) % 360;
  const ticks = [];
  for (let a = 0; a < 360; a += 30) {
    const r1 = a % 90 ? 58 : 54, x1 = 80 + r1 * Math.sin(rad(a)), y1 = 80 - r1 * Math.cos(rad(a)), x2 = 80 + 62 * Math.sin(rad(a)), y2 = 80 - 62 * Math.cos(rad(a));
    ticks.push(svg('line', { x1, y1, x2, y2, stroke: '#2a5a70', 'stroke-width': 1.5 }));
  }
  const needle = svg('g', { class: 'needle', style: `--rot:${toward}deg; transform: rotate(${toward}deg)` },
    svg('path', { d: 'M80 30 L99 100 L80 86 L61 100 Z', fill: 'rgba(34,211,238,0.12)', stroke: '#22d3ee', 'stroke-width': 3, 'stroke-linejoin': 'round', filter: 'url(#cGlow)' }));
  const old = daysAgo(w.date) > 7;
  return card('', title('1. Viento', w.date ? `dato del ${ddmm(w.date)}` : null),
    el('div', { class: 'compass' }, svg('svg', { viewBox: '0 0 160 160', role: 'img', 'aria-label': `Viento de ${w.kmh} km/h, sopla del ${w.from} hacia el ${w.toward || ''}` },
      svg('defs', {}, svg('filter', { id: 'cGlow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, svg('feGaussianBlur', { stdDeviation: 2.5, result: 'b' }), svg('feMerge', {}, svg('feMergeNode', { in: 'b' }), svg('feMergeNode', { in: 'SourceGraphic' })))),
      svg('circle', { cx: 80, cy: 80, r: 70, fill: 'none', stroke: '#22d3ee', 'stroke-width': 4, 'stroke-dasharray': '300 140', transform: 'rotate(-60 80 80)', filter: 'url(#cGlow)' }),
      svg('circle', { cx: 80, cy: 80, r: 62, fill: 'rgba(6,16,25,0.6)', stroke: '#1b3546', 'stroke-width': 1 }),
      ticks,
      svg('path', { d: 'M80 4 L86 14 L74 14 Z', fill: '#22d3ee' }),
      svg('text', { x: 80, y: 32, 'text-anchor': 'middle' }, 'N'), svg('text', { x: 130, y: 84, 'text-anchor': 'middle' }, 'E'),
      svg('text', { x: 80, y: 136, 'text-anchor': 'middle' }, 'S'), svg('text', { x: 30, y: 84, 'text-anchor': 'middle' }, 'O'),
      needle)),
    el('p', { class: 'big-line' }, `${fmtN(w.kmh)} km/h${w.toward ? ', hacia el ' + w.toward : ''}`),
    el('p', { class: 'fp-sub' }, `Sopla del ${w.from} (${fmtN(w.fromDeg)}°).` + (old ? ' Es el último dato disponible; no se usa en el puntaje.' : '')));
}

function airCard(a) {
  if (!a || a.tC == null) return card('', title('2. Aire'), el('p', { class: 'fp-empty' }, 'Sin dato de temperatura del aire.'));
  const f = Math.max(0, Math.min(1, (a.tC + 5) / 50)), tubeTop = 8, tubeH = 84, h = tubeH * f;
  const thermo = svg('svg', { class: 'thermo', viewBox: '0 0 40 124', 'aria-hidden': 'true' },
    svg('defs', {}, svg('linearGradient', { id: 'tGrad', x1: 0, y1: 1, x2: 0, y2: 0 }, svg('stop', { offset: 0, 'stop-color': '#ff3b2f' }), svg('stop', { offset: 1, 'stop-color': '#ff9a2e' }))),
    svg('rect', { x: 13, y: tubeTop - 2, width: 14, height: tubeH + 12, rx: 7, fill: 'rgba(6,16,25,0.6)', stroke: '#9cb3bf', 'stroke-width': 1.5 }),
    svg('rect', { x: 17, y: tubeTop + tubeH - h, width: 6, height: h + 8, rx: 3, fill: 'url(#tGrad)' }),
    svg('circle', { cx: 20, cy: 106, r: 13, fill: 'rgba(6,16,25,0.6)', stroke: '#9cb3bf', 'stroke-width': 1.5 }),
    svg('circle', { cx: 20, cy: 106, r: 9, fill: '#ff3b2f', style: 'filter: drop-shadow(0 0 6px #ff3b2f)' }));
  let rhSvg = null;
  if (a.rh != null) {
    const R = 46, C = 2 * Math.PI * R, span = 0.75 * C, dry = a.rh < 30;
    const arc = svg('circle', { class: 'rh-arc', cx: 60, cy: 60, r: R, fill: 'none', stroke: dry ? '#ff6b2c' : '#22d3ee', 'stroke-width': 10, 'stroke-linecap': 'round', 'stroke-dasharray': `${span * (a.rh / 100)} ${C}`, transform: 'rotate(135 60 60)', style: `--c:${C}px; filter: drop-shadow(0 0 6px ${dry ? '#ff6b2c' : '#22d3ee'})` });
    // El número va en HTML encima del anillo, centrado con grid: no se corre aunque cambie el tamaño de la tarjeta
    rhSvg = el('div', { class: 'rh', role: 'img', 'aria-label': `Humedad relativa ${Math.round(a.rh)} %` },
      svg('svg', { viewBox: '0 0 120 120', 'aria-hidden': 'true' },
        svg('circle', { cx: 60, cy: 60, r: R, fill: 'none', stroke: '#1b3546', 'stroke-width': 10, 'stroke-linecap': 'round', 'stroke-dasharray': `${span} ${C}`, transform: 'rotate(135 60 60)' }),
        arc),
      el('span', { class: 'rh-val', 'aria-hidden': 'true' }, el('b', {}, `${Math.round(a.rh)}%`), el('small', {}, 'HR')));
  }
  const msg = a.rh == null ? '' : a.rh < 30 ? 'Aire muy seco: favorece el fuego.' : a.rh >= 60 ? 'Aire húmedo: frena el fuego.' : 'Humedad intermedia.';
  return card('', title('2. Aire', a.date ? `dato del ${ddmm(a.date)}` : null),
    el('div', { class: 'air' }, el('div', { class: 'temp' }, thermo, el('span', { class: 'temp-val' }, `${fmtN(a.tC, 1)}°C`)), rhSvg),
    msg ? el('p', { class: 'fp-sub' }, msg) : null);
}

function soilCard(so, terrain) {
  if (!so) return card('', title('3. Suelo'), el('p', { class: 'fp-empty' }, 'Sin dato de humedad del suelo.'));
  const bar = (label, v) => {
    const i = el('i', { class: v != null && v < 15 ? 'dry' : 'wet', style: v != null ? `width:${Math.min(100, (v / 50) * 100)}%` : null });
    return el('div', { class: 'bar-row' }, el('div', { class: 'lbl' }, el('span', {}, label), el('b', {}, v == null ? 'sin dato' : `${fmtN(v)} %`)), el('div', { class: 'track' }, i));
  };
  const rel = so.rel ? so.rel[0].toUpperCase() + so.rel.slice(1) : null;
  return card('', title('3. Suelo', so.date ? `dato del ${ddmm(so.date)}` : null),
    bar('Superficial (0-5 cm)', so.surface), bar('Raíces (0-100 cm)', so.root), el('div', { class: 'soil-strata', 'aria-hidden': 'true' }),
    el('p', { class: 'fp-sub' }, [rel ? `${rel}${so.pctl != null ? ` (percentil ${fmtN(so.pctl)})` : ''}.` : null, terrain && terrain.texture ? ` Suelo ${terrain.texture}.` : null].filter(Boolean).join('') || 'Humedad en % del volumen del suelo.'));
}

function rainCard(r) {
  if (!r || (r.mm7 == null && r.mm30 == null)) return card('', title('4. Lluvia'), el('p', { class: 'fp-empty' }, 'Sin datos de lluvia.'));
  const bars = [
    { label: '7 días', v: r.mm7, color: '#22d3ee', date: r.date7 },
    { label: '30 días', v: r.mm30, color: '#14b8a6', date: r.date30 },
  ];
  const W = 240, H = 140, base = 112, top = 16;
  const max = Math.max(10, ...bars.map((b) => b.v || 0)) * 1.15;
  const g = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Lluvia: ${fmtN(r.mm7, 1)} mm en 7 días y ${fmtN(r.mm30)} mm en 30 días` });
  for (let i = 0; i <= 3; i++) { const y = base - ((base - top) * i) / 3; g.append(svg('line', { class: 'gridl', x1: 28, x2: W - 4, y1: y, y2: y }), svg('text', { x: 22, y: y + 4, 'text-anchor': 'end' }, String(Math.round((max * i) / 3)))); }
  bars.forEach((b, i) => {
    const x = 58 + i * 100, bw = 54;
    if (b.v == null) { g.append(svg('text', { x: x + bw / 2, y: base - 8, 'text-anchor': 'middle' }, 'sin dato')); }
    else {
      const h = Math.max(2, ((base - top) * b.v) / max);
      const rect = svg('rect', { class: 'bar', x, y: base - h, width: bw, height: h, rx: 4, fill: b.color, style: `filter: drop-shadow(0 0 6px ${b.color}88)` });
      g.append(rect, svg('text', { class: 'val', x: x + bw / 2, y: base - h - 6, 'text-anchor': 'middle' }, `${fmtN(b.v, b.v < 10 ? 1 : 0)} mm`));
    }
    g.append(svg('text', { x: x + bw / 2, y: base + 16, 'text-anchor': 'middle' }, b.label + (b.date ? ` · ${ddmm(b.date).slice(0, 5)}` : '')));
  });
  const lag = r.date30 && daysAgo(r.date30) > 12;
  return card('rain', title('4. Lluvia', 'mm acumulados'), g,
    el('p', { class: 'fp-sub' }, (r.dryDays != null ? `${r.dryDays === 0 ? 'Llovió en el último día con datos' : `${r.dryDays} ${r.dryDays === 1 ? 'día seco' : 'días secos'} seguidos`}. ` : '') +
      '7 días: NASA GPM IMERG. 30 días: CHIRPS' + (lag ? ` (último dato del ${ddmm(r.date30)}).` : '.')));
}

function factorsCard(s) {
  const fs = s.factors || [];
  const li = (f, kind) => el('li', { class: kind }, el('span', { class: 'ico' }, icon(f.key)), FACTOR_TEXT[f.key] ? FACTOR_TEXT[f.key][kind === 'risk' ? 0 : 1] : f.label);
  const risks = fs.filter((f) => f.up).sort((a, b) => b.points / b.max - a.points / a.max);
  const calms = fs.filter((f) => f.down);
  return card('fp-full', el('div', { class: 'factors' },
    el('div', { class: 'fgroup' }, el('h5', {}, 'Factores de riesgo'),
      risks.length ? el('ul', { class: 'ficons' }, risks.map((f) => li(f, 'risk'))) : el('p', { class: 'fp-empty', style: 'text-align:center' }, 'Ningún factor favorece mucho el fuego.')),
    el('div', { class: 'fgroup' }, el('h5', {}, 'Contención'),
      calms.length ? el('ul', { class: 'ficons' }, calms.map((f) => li(f, 'calm'))) : el('p', { class: 'fp-empty', style: 'text-align:center' }, 'Nada lo frena de forma marcada.'))),
    s.windToward ? el('p', { class: 'windline' }, `➜ Si hubiera fuego, el viento lo llevaría hacia el ${s.windToward}.`) : null);
}

function vegCard(v) {
  if (!v) return card('', title('Vegetación'), el('p', { class: 'fp-empty' }, 'Sin imágenes útiles de vegetación.'));
  const kv = (k, val) => (val ? el('div', {}, el('span', {}, k), el('b', {}, val)) : null);
  return card('', title('Vegetación', v.date ? 'Sentinel-2' : null),
    el('div', { class: 'kv' },
      kv('Cobertura', v.cover),
      kv('Verdor (NDVI)', v.ndvi ? `${v.ndvi} · ${v.ndviTxt}` : null),
      kv('Humedad (NDMI)', v.ndmi ? `${v.ndmi} · ${v.ndmiTxt}` : null)));
}

function terrainCard(t) {
  const kv = (k, val) => (val ? el('div', {}, el('span', {}, k), el('b', {}, val)) : null);
  const cls = t.slope == null ? null : t.slope < 5 ? 'plano' : t.slope < 10 ? 'suave' : t.slope < 20 ? 'inclinado' : 'empinado';
  const any = t.slope != null || t.elev != null || t.texture;
  return card('', title('Relieve y suelo'),
    any ? el('div', { class: 'kv' },
      kv('Pendiente', t.slope != null ? `${fmtN(t.slope)}° · ${cls}` : null),
      kv('Altitud', t.elev != null ? `${fmtN(t.elev)} m` : null),
      kv('Textura', t.texture || null)) : el('p', { class: 'fp-empty' }, 'Sin datos de relieve.'),
    t.textureNote ? el('p', { class: 'fp-sub' }, t.textureNote[0].toUpperCase() + t.textureNote.slice(1) + '.') : null,
    t.degraded ? el('p', { class: 'fp-sub' }, t.degraded) : null);
}

function advancedCard(s) {
  return el('details', { class: 'card fp-full advbar' },
    el('summary', {}, el('span', {}, 'Datos avanzados y fuentes (suelo, vegetación, radar)'), el('b', {}, 'Ver más')),
    el('div', { class: 'adv-body' },
      el('h5', {}, 'Conclusión'), el('p', {}, s.conclusion),
      el('h5', {}, 'Resumen en palabras'),
      ...s.items.map((i) => el('div', { class: 'dato' }, el('b', {}, i.label), el('span', {}, i.text))),
      el('h5', {}, 'Datos por fuente'),
      ...s.rows.map((r) => el('div', { class: 'src-row' }, el('b', {}, r.label), el('span', {}, r.value), el('small', {}, [r.date ? 'Fecha: ' + r.date : null, r.source].filter(Boolean).join(' · ')))),
      el('p', { class: 'fine' }, s.notes.join(' '))));
}

function renderFocus(p, s, head, stationsCard) {
  const m = metricsOf(s);
  panel.replaceChildren(
    head,
    gaugeCard(s),
    windCard(m.wind),
    airCard(m.air),
    soilCard(m.soil, m.terrain),
    rainCard(m.rain),
    factorsCard(s),
    vegCard(m.veg),
    terrainCard(m.terrain),
    stationsCard,
    advancedCard(s));
}

// ---------- Gráfico de comparación (SVG propio, sin librerías) ----------
function niceMax(m) {
  const p = 10 ** Math.floor(Math.log10(m));
  for (const k of [1, 2, 4, 5, 8, 10]) if (k * p >= m) return k * p;
  return 10 * p;
}
function groupedBars(rows, series, label) {
  const W = 760, H = 264, M = { l: 44, r: 8, t: 12, b: 30 };
  const iw = W - M.l - M.r, ih = H - M.t - M.b;
  const max = niceMax(Math.max(1, ...rows.flatMap((r) => series.map((s) => r[s.key] ?? 0))));
  const band = iw / rows.length, pad = band * 0.18, bw = (band - pad * 2) / series.length;
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': label, class: 'chart' });
  for (let i = 0; i <= 4; i++) {
    const y = M.t + ih - (ih * i) / 4;
    root.append(svg('line', { class: 'grid', x1: M.l, x2: W - M.r, y1: y, y2: y }),
      svg('text', { x: M.l - 8, y: y + 4, 'text-anchor': 'end' }, String(Math.round((max * i) / 4))));
  }
  rows.forEach((r, i) => {
    const x0 = M.l + i * band;
    series.forEach((s, j) => {
      const v = r[s.key];
      if (v == null) return;
      const h = (ih * v) / max;
      root.append(svg('rect', { class: 'bar', x: x0 + pad + j * bw, y: M.t + ih - h, width: Math.max(1, bw - 3), height: h, rx: 3, style: `fill:${s.color}` },
        svg('title', {}, `${shortDate(r.date)}: ${s.label} ${v}`)));
    });
    root.append(svg('text', { x: x0 + band / 2, y: H - 10, 'text-anchor': 'middle' }, shortDate(r.date)));
  });
  return root;
}

// ---------- Calendario mensual (casillas por día, semanas de lunes a domingo) ----------
const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const toUTC = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const isoDay = (dt) => dt.toISOString().slice(0, 10);
const mondayIndex = (dt) => (dt.getUTCDay() + 6) % 7;
let calDays = [], calSelected = null;

function heatLevel(v, max) {
  if (!v) return 0;
  const f = v / max;
  return f > 0.75 ? 4 : f > 0.5 ? 3 : f > 0.25 ? 2 : 1;
}
function monthTitle(first, last) {
  const m1 = first.getUTCMonth(), m2 = last.getUTCMonth(), y1 = first.getUTCFullYear(), y2 = last.getUTCFullYear();
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  if (m1 === m2 && y1 === y2) return `${cap(MESES_LARGOS[m1])} ${y1}`;
  if (y1 === y2) return `${cap(MESES_LARGOS[m1])} – ${MESES_LARGOS[m2]} ${y2}`;
  return `${cap(MESES_LARGOS[m1])} ${y1} – ${MESES_LARGOS[m2]} ${y2}`;
}

function renderMonthGrid(cal) {
  calDays = cal;
  const byDate = new Map(cal.map((c) => [c.date, c]));
  if (!calSelected || !byDate.has(calSelected)) calSelected = cal[cal.length - 1].date;
  const max = Math.max(1, ...cal.map((c) => c.unified));
  const first = toUTC(cal[0].date), last = toUTC(cal[cal.length - 1].date);
  const todayUTC = isoDay(new Date());
  $('#calMonth').textContent = monthTitle(first, last);

  const start = new Date(first); start.setUTCDate(start.getUTCDate() - mondayIndex(first));
  const end = new Date(last); end.setUTCDate(end.getUTCDate() + 6 - mondayIndex(last));
  const cells = DIAS_CORTOS.map((d) => el('div', { class: 'cal-wd', 'aria-hidden': 'true' }, d));
  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = isoDay(d), c = byDate.get(key), n = d.getUTCDate();
    const label = (n === 1 || key === cal[0].date) ? `${n} ${MESES[d.getUTCMonth()]}` : String(n);
    if (!c) { cells.push(el('div', { class: 'cal-day out', 'aria-hidden': 'true' }, el('span', { class: 'dnum' }, label))); continue; }
    const lvl = heatLevel(c.unified, max);
    const isToday = key === todayUTC;
    cells.push(el('button', {
      type: 'button', class: `cal-day lv${lvl}${key === calSelected ? ' sel' : ''}`, 'data-date': key,
      'aria-pressed': String(key === calSelected),
      'aria-label': `${DIAS_LARGOS[d.getUTCDay()]} ${n} de ${MESES_LARGOS[d.getUTCMonth()]}: ${c.unified} zonas con fuego. MODIS ${c.modis}, VIIRS ${c.viirs}.${isToday ? ' Hoy, datos parciales.' : ''}`,
      onclick: () => selectCalDay(key),
    },
      el('span', { class: 'dnum' }, label, isToday ? el('em', { class: 'today' }, 'hoy') : null),
      el('b', { class: 'count' }, fmtN(c.unified)),
      el('span', { class: 'unit' }, c.unified === 1 ? 'zona' : 'zonas'),
      el('span', { class: 'sens' },
        el('span', {}, el('i', { class: 'g ring' }), fmtN(c.modis)),
        el('span', {}, el('i', { class: 'g dot' }), fmtN(c.viirs)))));
  }
  $('#calGrid').replaceChildren(...cells);
  renderCalDetail();
}

function selectCalDay(key) {
  calSelected = key;
  document.querySelectorAll('#calGrid .cal-day[data-date]').forEach((b) => {
    const on = b.dataset.date === key;
    b.classList.toggle('sel', on);
    b.setAttribute('aria-pressed', String(on));
  });
  renderCalDetail();
}

function renderCalDetail() {
  const c = calDays.find((x) => x.date === calSelected);
  if (!c) return $('#calDetail').replaceChildren();
  const d = toUTC(c.date);
  const isToday = c.date === isoDay(new Date());
  let compare;
  if (c.baseline == null) compare = 'No hay datos de años anteriores para comparar este día.';
  else if (c.baseline === 0) compare = c.comparable > 0 ? 'En esta fecha de años anteriores casi no hubo actividad.' : 'Igual que en años anteriores: sin actividad en esta fecha.';
  else if (c.ratio >= 1.5) compare = `Más que lo habitual: unas ${(Math.round(c.ratio * 10) / 10).toLocaleString('es-PY')} veces lo que se vio en esta fecha en años anteriores.`;
  else if (c.ratio <= 0.67) compare = 'Menos que lo habitual para esta fecha en años anteriores.';
  else compare = 'Parecido a lo habitual para esta fecha en años anteriores.';
  const stat = (label, value, glyph) => el('div', { class: 'stat' }, el('span', {}, glyph, label), el('b', {}, value));
  $('#calDetail').replaceChildren(
    el('div', { class: 'cd-head' },
      el('h4', {}, `${DIAS_LARGOS[d.getUTCDay()][0].toUpperCase()}${DIAS_LARGOS[d.getUTCDay()].slice(1)} ${d.getUTCDate()} de ${MESES_LARGOS[d.getUTCMonth()]}`),
      el('p', { class: 'cd-big' }, el('b', {}, fmtN(c.unified)), c.unified === 1 ? ' zona con fuego detectado' : ' zonas con fuego detectado'),
      isToday ? el('p', { class: 'cd-note' }, 'Hoy: el día todavía no terminó y faltan pasadas de satélite.') : null),
    el('div', { class: 'cd-stats' },
      stat('MODIS', fmtN(c.modis), el('i', { class: 'g ring' })),
      stat('VIIRS', fmtN(c.viirs), el('i', { class: 'g dot' })),
      stat('Vistas por ambos', fmtN(c.both)),
      stat('Confianza alta', fmtN(c.high)),
      stat('Potencia', `${fmtN(Math.round(c.frp))} MW`)),
    el('p', { class: 'cd-compare' }, compare));
}

// ---------- Calendario: carga ----------
async function loadCalendar() {
  setStatus($('#calStatus'), 'Uniendo MODIS y VIIRS y comparando con años anteriores. Puede tardar unos segundos.', 'loading');
  try {
    const d = await api('/api/analysis?days=' + radio('calDays'));
    calLoaded = true;
    const failed = d.sourcesFailed.length ? ` Sin respuesta de: ${d.sourcesFailed.join(', ')}.` : '';
    const years = d.method.baselineYears.length ? d.method.baselineYears.join(' y ') : 'sin datos disponibles';
    setStatus($('#calStatus'), `Del ${d.start} al ${d.end} (UTC). Años de comparación: ${years}.${failed}`);
    renderCalendar(d);
  } catch (e) {
    setStatus($('#calStatus'), 'No se pudo cargar el análisis: ' + e.message + ' Probá de nuevo con Actualizar.', 'err');
  }
}
function renderCalendar(d) {
  renderMonthGrid(d.calendar);

  const hasBase = d.calendar.some((c) => c.baseline != null);
  $('#chartBase').replaceChildren(hasBase
    ? groupedBars(d.calendar, [
        { key: 'comparable', label: 'Este año', color: COLOR.uni },
        { key: 'baseline', label: 'Promedio histórico', color: COLOR.hist },
      ], 'Zonas con actividad este año frente al promedio histórico')
    : el('p', { class: 'empty' }, 'No hay archivo histórico disponible para estas fechas, así que no se puede comparar con años anteriores.'));

  $('#zones').replaceChildren(...(d.topZones.length ? d.topZones.map((z) =>
    el('li', {},
      el('div', {}, el('b', {}, `${z.n} detecciones`), el('div', { class: 'meta' }, `Cuadrante ${z.lat.toFixed(1)}°, ${z.lon.toFixed(1)}° (0,5° de lado), potencia total ${z.frp} MW`)),
      el('button', { class: 'btn', onclick: () => { showTab('mapa'); map.setView([z.lat + 0.25, z.lon + 0.25], 9); } }, 'Ver en el mapa')))
    : [el('li', {}, el('span', { class: 'meta' }, 'No hubo detecciones en esta ventana.'))]));

  $('#method').replaceChildren(...Object.values(d.method).filter((v) => typeof v === 'string').map((t) => el('p', {}, t)));

  const head = ['Fecha', 'MODIS', 'VIIRS', 'Zonas únicas', 'En ambos', 'Confianza alta', 'Potencia (MW)', 'Histórico', 'Razón', 'Puntaje z'];
  $('#calTable').replaceChildren(
    el('tr', {}, head.map((h) => el('th', {}, h))),
    ...d.calendar.map((c) => el('tr', {}, [c.date, c.modis, c.viirs, c.unified, c.both, c.high, c.frp,
      c.baseline ?? '—', c.ratio ?? '—', c.z].map((v) => el('td', {}, v)))));
}
$('#btnCal').addEventListener('click', loadCalendar);
document.querySelectorAll('input[name="calDays"]').forEach((i) => i.addEventListener('change', loadCalendar));

// ---------- Reportar ----------
const pickMap = L.map('pickmap').fitBounds(PY_BOUNDS);
dark().addTo(pickMap);
let pickMarker = null, picked = null;
function setPick(lat, lon) {
  picked = { lat, lon };
  if (pickMarker) pickMarker.setLatLng([lat, lon]); else pickMarker = L.marker([lat, lon]).addTo(pickMap);
  setStatus($('#pickCoords'), `Ubicación marcada: ${lat.toFixed(5)}, ${lon.toFixed(5)}`, 'ok');
}
pickMap.on('click', (e) => setPick(e.latlng.lat, e.latlng.lng));
$('#btnPickLoc').addEventListener('click', () => {
  if (!navigator.geolocation) return alert('Tu navegador no permite usar la ubicación.');
  navigator.geolocation.getCurrentPosition((p) => { setPick(p.coords.latitude, p.coords.longitude); pickMap.setView([p.coords.latitude, p.coords.longitude], 13); }, () => alert('No se pudo obtener tu ubicación. Revisá el permiso del navegador.'));
});
$('#repForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!picked) return setStatus($('#repMsg'), 'Marcá primero el lugar en el mapa.', 'err');
  if ($('#repDesc').value.trim().length < 10) return setStatus($('#repMsg'), 'Contá qué viste, con al menos 10 caracteres.', 'err');
  const btn = e.submitter || $('#repForm button[type=submit]');
  btn.disabled = true;
  try {
    const r = await api('/api/reports', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...picked, description: $('#repDesc').value, name: $('#repName').value, contact: $('#repContact').value, website: $('#repWebsite').value }),
    });
    setStatus($('#repMsg'), `Reporte enviado con el código ${r.id}. Queda pendiente hasta que Bomberos lo revise. Si hay peligro, llamá al 911 o al 132.`, 'ok');
    $('#repForm').reset();
    setStatus($('#pickCoords'), 'Ubicación sin marcar.');
    picked = null;
    if (pickMarker) { pickMap.removeLayer(pickMarker); pickMarker = null; }
    await loadPublicReports();
    if (!reportsList.some((x) => String(x.id) === String(r.id))) {
      setStatus($('#repMsg'), `Reporte enviado con el código ${r.id}, pero el servidor todavía no lo devuelve en el mapa.`, 'err');
    }
  } catch (err) { setStatus($('#repMsg'), err.message, 'err'); }
  finally { btn.disabled = false; }
});

// ---------- Bomberos ----------
let token = '';
try { token = sessionStorage.getItem('fgtoken') || ''; } catch { /* sin almacenamiento */ }
const saveToken = (t) => { try { t ? sessionStorage.setItem('fgtoken', t) : sessionStorage.removeItem('fgtoken'); } catch { /* sin almacenamiento */ } };
const adminApi = (url, opts = {}) => api(url, { ...opts, headers: { 'x-admin-token': token, 'content-type': 'application/json' } });
$('#btnLogin').addEventListener('click', async () => {
  token = $('#tokenInput').value.trim();
  try {
    await adminApi('/api/admin/reports');
    saveToken(token);
    $('#tokenInput').value = '';
    setStatus($('#loginMsg'), '');
    loadAdmin();
  } catch (e) { token = ''; setStatus($('#loginMsg'), e.message, 'err'); }
});
$('#tokenInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btnLogin').click(); });
$('#btnLogout').addEventListener('click', () => { token = ''; saveToken(''); $('#adminBox').hidden = true; $('#loginBox').hidden = false; });
$('#btnAdminReload').addEventListener('click', loadAdmin);

async function loadAdmin() {
  try {
    const [reps, alerts] = await Promise.all([adminApi('/api/admin/reports'), adminApi('/api/admin/alerts').catch(() => null)]);
    $('#loginBox').hidden = true; $('#adminBox').hidden = false;
    $('#alerts').replaceChildren(...(alerts === null
      ? [el('p', { class: 'note' }, 'No se pudieron calcular las alertas. Puede que NASA FIRMS no haya respondido.')]
      : alerts.length ? alerts.map((a) => el('div', { class: 'item alert' },
          el('div', { class: 'top' }, el('b', {}, `Reporte ${a.reportId}`)),
          `A ${a.nearest.km} km de una detección ${a.nearest.sensor} (confianza ${CONF[a.nearest.conf]}, ${a.nearest.date} ${a.nearest.time.slice(0, 2)}:${a.nearest.time.slice(2)} UTC).`,
          el('div', {}, a.description)))
      : [el('p', { class: 'note' }, 'Ningún reporte abierto coincide con una detección cercana por ahora.')]));
    $('#adminReports').replaceChildren(...(reps.length ? reps.map(renderAdminReport) : [el('p', { class: 'note' }, 'Todavía no hay reportes.')]));
  } catch (e) {
    $('#loginBox').hidden = false; $('#adminBox').hidden = true;
    setStatus($('#loginMsg'), e.message, 'err');
  }
}
function renderAdminReport(r) {
  const note = el('input', { type: 'text', placeholder: 'Nota (opcional)', maxlength: '300', 'aria-label': 'Nota para el historial' });
  const sel = el('select', { 'aria-label': 'Estado del reporte' }, ['pendiente', 'verificado', 'atendido', 'descartado'].map((s) => el('option', s === r.status ? { value: s, selected: '' } : { value: s }, s)));
  const save = el('button', { class: 'btn primary', onclick: async () => {
    try { await adminApi('/api/admin/reports/' + r.id, { method: 'PATCH', body: JSON.stringify({ status: sel.value, note: note.value }) }); loadAdmin(); loadPublicReports(); }
    catch (e) { alert(e.message); }
  } }, 'Guardar');
  const n = nearestStations(r.lat, r.lon, 1)[0];
  return el('div', { class: 'item ' + r.status },
    el('div', { class: 'top' }, el('b', {}, `Reporte ${r.id}`), el('span', { class: 'pill ' + r.status }, r.status), el('small', {}, fmtDateTime(r.createdAt))),
    el('div', {}, r.description),
    el('small', {}, `Ubicación ${r.lat}, ${r.lon}` + (r.name ? `. Nombre: ${r.name}` : '') + (r.contact ? `. Contacto: ${r.contact}` : '') + (n ? `. Cuartel más cercano: ${stationName(n.s)}, a ${fmtKm(n.km)} km.` : '')),
    el('div', { class: 'controls' }, sel, note, save,
      el('button', { class: 'btn', onclick: () => { showTab('mapa'); map.setView([r.lat, r.lon], 13); } }, 'Ver en el mapa')),
    el('ul', { class: 'hist' }, r.history.map((h) => el('li', {}, `${fmtDateTime(h.at)}: ${h.status}${h.note ? '. ' + h.note : ''}`))));
}

// ---------- Departamentos (17 + Distrito Capital) ----------
// Límites: DGEEC vía geoBoundaries (CC BY 4.0), simplificados en public/departamentos.json.
// Cada anillo viene "plano": [lon0, lat0, lon1, lat1, ...] para que el archivo pese menos.
let departments = [], selectedDept = null, deptHighlight = null, reportsList = [], deptSvgBuilt = false;
const deptLayer = L.layerGroup().addTo(map);
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII'];
const REGION = { oriental: 'Región Oriental', occidental: 'Chaco (Región Occidental)', capital: 'Distrito Capital' };
const deptNum = (d) => (d.num ? ROMAN[d.num] : 'Capital');
const ringLatLngs = (r) => { const out = []; for (let i = 0; i < r.length; i += 2) out.push([r[i + 1], r[i]]); return out; };
function inRing(r, x, y) {
  let inside = false;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function deptOf(lat, lon) {
  for (const d of departments) {
    const [w, s, e, n] = d.bbox;
    if (lon < w || lon > e || lat < s || lat > n) continue;
    if (d.rings.some((r) => inRing(r, lon, lat))) return d;
  }
  return null;
}
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
function assignDepts() {
  if (!departments.length) return;
  for (const p of fires) if (p.dept === undefined) p.dept = deptOf(p.lat, p.lon)?.id ?? null;
  // Los cuarteles ya traen su departamento en bomberos.json (campo "p"); si no coincide, se ubica por coordenadas
  for (const s of stations) if (s.dept === undefined) s.dept = (departments.find((d) => norm(d.name) === norm(s.p)) || deptOf(s.lat, s.lon))?.id ?? null;
}
const stationsIn = (d) => stations.filter((s) => s.dept === d.id).length;

async function loadDepartments() {
  try {
    departments = (await api('/departamentos.json')).departments;
    for (const d of departments) L.polygon(d.rings.map(ringLatLngs), { color: '#3f7489', weight: 1, opacity: 0.6, fill: false, interactive: false }).addTo(deptLayer);
    $('#deptSelect').append(...[...departments].sort((a, b) => a.name.localeCompare(b.name, 'es'))
      .map((d) => el('option', { value: d.id }, d.num ? d.name : `${d.name} (Distrito Capital)`)));
    assignDepts();
    renderDepartments();
    if (!selected) renderOverview();
  } catch {
    setStatus($('#deptStatus'), 'No se pudieron cargar los límites de los departamentos. Probá recargar la página.', 'err');
  }
}

// Ir directo a un departamento: lo resalta, lo encuadra en el mapa y filtra el panel. '' = todo Paraguay.
function goToDept(id) {
  const d = departments.find((x) => x.id === id) || null;
  if (selected) closeFocus();
  if (deptHighlight) { map.removeLayer(deptHighlight); deptHighlight = null; }
  selectedDept = d;
  $('#deptSelect').value = d ? d.id : '';
  showTab('mapa');
  map.invalidateSize();
  if (d) {
    deptHighlight = L.polygon(d.rings.map(ringLatLngs), { color: '#22d3ee', weight: 2.5, fillColor: '#22d3ee', fillOpacity: 0.07, interactive: false }).addTo(map);
    map.fitBounds([[d.bbox[1], d.bbox[0]], [d.bbox[3], d.bbox[2]]], { padding: [24, 24] });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    map.fitBounds(PY_BOUNDS);
  }
  renderOverview();
}
$('#deptSelect').addEventListener('change', (e) => goToDept(e.target.value));

// Proyección simple para dibujar Paraguay en SVG (lon corregida por la latitud media)
const K = Math.cos(rad(23.4));
function pathOf(rings, w, n, sc) {
  return rings.map((r) => {
    let s = '';
    for (let i = 0; i < r.length; i += 2) s += (i ? 'L' : 'M') + ((r[i] - w) * K * sc).toFixed(1) + ' ' + ((n - r[i + 1]) * sc).toFixed(1);
    return s + 'Z';
  }).join('');
}
function centroidOf(r) { // centro de masa del anillo más grande, para poner la etiqueta
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    const f = r[j] * r[i + 1] - r[i] * r[j + 1];
    a += f; cx += (r[j] + r[i]) * f; cy += (r[j + 1] + r[i + 1]) * f;
  }
  return a ? [cx / (3 * a), cy / (3 * a)] : [r[0], r[1]];
}
function miniSvg(d) {
  const [w, s, e, n] = d.bbox, sc = 52 / Math.max((e - w) * K, n - s);
  const ox = (56 - (e - w) * K * sc) / 2, oy = (56 - (n - s) * sc) / 2;
  return svg('svg', { class: 'dc-mini', viewBox: '0 0 56 56', 'aria-hidden': 'true' },
    svg('path', { d: pathOf(d.rings, w, n, sc), transform: `translate(${ox.toFixed(1)} ${oy.toFixed(1)})` }));
}
function buildDeptMap() {
  const all = departments.map((d) => d.bbox);
  const w = Math.min(...all.map((b) => b[0])), s = Math.min(...all.map((b) => b[1]));
  const e = Math.max(...all.map((b) => b[2])), n = Math.max(...all.map((b) => b[3]));
  const sc = 1000 / ((e - w) * K), H = (n - s) * sc;
  const root = svg('svg', { viewBox: `-6 -6 1012 ${(H + 12).toFixed(0)}`, class: 'dept-svg', role: 'img', 'aria-label': 'Mapa de Paraguay dividido en sus 17 departamentos y Asunción' });
  const labels = [];
  for (const d of departments) {
    const big = d.rings.reduce((a, r) => (r.length > a.length ? r : a), d.rings[0]);
    const path = svg('path', { class: 'dept-path lv0', 'data-id': d.id, d: pathOf(d.rings, w, n, sc) }, svg('title', {}, d.name));
    path.addEventListener('click', () => goToDept(d.id));
    path.addEventListener('mouseenter', () => $(`#deptList [data-id="${d.id}"]`)?.classList.add('hover'));
    path.addEventListener('mouseleave', () => $(`#deptList [data-id="${d.id}"]`)?.classList.remove('hover'));
    root.append(path);
    if (d.num) {
      const [cx, cy] = centroidOf(big);
      labels.push(svg('text', { class: 'dept-lbl', x: ((cx - w) * K * sc).toFixed(0), y: ((n - cy) * sc + 6).toFixed(0), 'text-anchor': 'middle' }, ROMAN[d.num]));
    }
  }
  root.append(...labels); // las etiquetas van arriba de todas las formas
  $('#deptMap').replaceChildren(root);
  deptSvgBuilt = true;
}

function renderDepartments() {
  if (!departments.length || !$('#departamentos').classList.contains('active')) return;
  if (!deptSvgBuilt) buildDeptMap();
  assignDepts();
  const st = new Map(departments.map((d) => [d.id, { n: 0, max: 0, high: 0 }]));
  let outside = 0;
  for (const p of visible) {
    const s = st.get(p.dept);
    if (!s) { outside++; continue; }
    s.n++; s.max = Math.max(s.max, p.frp); if (p.conf === 'high') s.high++;
  }
  const max = Math.max(1, ...[...st.values()].map((s) => s.n));
  const days = radio('days');
  setStatus($('#deptStatus'), !fires.length ? 'Cargando focos…'
    : `${fmtN(visible.length - outside)} focos dentro de Paraguay en ${days === '1' ? 'el último día' : `los últimos ${days} días`} (el período y los filtros se eligen en la pestaña Mapa)` +
      (outside ? `. Otros ${fmtN(outside)} caen en países vecinos y no se cuentan.` : '.'));

  document.querySelectorAll('#deptMap .dept-path').forEach((p) => {
    const s = st.get(p.dataset.id), d = departments.find((x) => x.id === p.dataset.id);
    p.setAttribute('class', `dept-path lv${heatLevel(s.n, max)}${selectedDept?.id === d.id ? ' sel' : ''}`);
    p.querySelector('title').textContent = `${d.name}: ${s.n} ${s.n === 1 ? 'foco' : 'focos'}`;
  });

  const byAct = radio('deptSort') === 'act';
  const list = [...departments].sort(byAct ? (a, b) => st.get(b.id).n - st.get(a.id).n || a.num - b.num : (a, b) => a.num - b.num);
  $('#deptList').replaceChildren(...list.map((d) => {
    const s = st.get(d.id), cuarteles = stationsIn(d);
    return el('button', {
      type: 'button', class: `card dept-card lv${heatLevel(s.n, max)}${selectedDept?.id === d.id ? ' sel' : ''}`, 'data-id': d.id,
      'aria-label': `Ir a ${d.name}: ${s.n} focos, ${cuarteles} cuarteles de bomberos`,
      onclick: () => goToDept(d.id),
      onmouseenter: () => $(`#deptMap [data-id="${d.id}"]`)?.classList.add('hover'),
      onmouseleave: () => $(`#deptMap [data-id="${d.id}"]`)?.classList.remove('hover'),
    },
      miniSvg(d),
      el('span', { class: 'dc-body' },
        el('span', { class: 'dc-top' }, el('span', { class: 'dc-num' }, deptNum(d)), el('span', { class: 'dc-region' }, REGION[d.region])),
        el('b', { class: 'dc-name' }, d.name),
        el('small', { class: 'dc-cap' }, d.num ? `Capital: ${d.capital}` : 'Capital del país'),
        el('span', { class: 'dc-stats' },
          el('span', { class: 'dc-fires' }, el('b', {}, fmtN(s.n)), s.n === 1 ? ' foco' : ' focos'),
          el('span', { title: 'Cuarteles de bomberos' }, el('img', { src: STATION_ICON, alt: '' }), fmtN(cuarteles)),
          s.max ? el('span', { class: 'dc-max' }, `máx. ${fmtN(s.max)} MW`) : null),
        el('span', { class: 'dc-bar', 'aria-hidden': 'true' }, el('i', { style: `width:${((s.n / max) * 100).toFixed(1)}%` }))),
      el('span', { class: 'dc-go', 'aria-hidden': 'true' }, '→'));
  }));
}
document.querySelectorAll('input[name="deptSort"]').forEach((i) => i.addEventListener('change', renderDepartments));

// ---------- Inicio ----------
renderOverview();
loadDepartments();
loadFires();
loadPublicReports();
loadStations();

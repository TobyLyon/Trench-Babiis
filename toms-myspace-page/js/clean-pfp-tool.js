(function () {
  function byId(id) {
    return document.getElementById(id);
  }

  var upload = byId('tb-upload');
  var random = byId('tb-random');
  var reset = byId('tb-reset');
  var download = byId('tb-download');
  var canvas = byId('tb-canvas');

  if (!window.TBGeneratorEngine || !canvas) return;
  var engine = new window.TBGeneratorEngine({
    canvasId: 'tb-canvas',
    traitsRootId: 'tb-traits',
    transformsEnabled: false,
    fitScaleFactor: 1,
    layerOrder: [
      'background',
      'car',
      'body',
      'belt',
      'tattoos',
      'chain',
      'earrings',
      'right-hand',
      'left-hand',
      'shades',
      'flex',
      'headwear'
    ]
  });

  engine.setPostProcess(null);
  engine.setMaskCircle(false);
  engine.setTransparentBackground(true);

  function resetAll() {
    if (upload) upload.value = '';
    engine.clearLayers();
    engine.requestRender();
  }

  if (upload) {
    upload.onchange = function () {
      var file = upload.files && upload.files[0];
      if (!file) return;

      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          engine.setImageLayer('background', img, 'Uploaded Background');
          engine.requestRender();
          upload.value = '';
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    };
  }

  function randomizeTraits() {
    if (!engine.manifest || !engine.manifest.categories || !engine.manifest.categories.length) return;
    for (var i = 0; i < engine.manifest.categories.length; i++) {
      var cat = engine.manifest.categories[i];
      if (!cat || !cat.name || !cat.items || !cat.items.length) continue;
      var pick = cat.items[Math.floor(Math.random() * cat.items.length)];
      if (!pick || !pick.src) continue;
      engine.setCategoryAsset(cat.name, pick.src, pick.name || pick.src);
    }
    engine.requestRender();
  }

  if (random) {
    random.onclick = function (e) {
      if (e && e.preventDefault) e.preventDefault();
      randomizeTraits();
      return false;
    };
  }

  if (reset) {
    reset.onclick = function (e) {
      if (e && e.preventDefault) e.preventDefault();
      resetAll();
      return false;
    };
  }

  if (download) {
    download.onclick = function (e) {
      if (e && e.preventDefault) e.preventDefault();
      
      // Render final image with attribution
      engine._render(true);
      
      // Add subtle attribution watermark
      var ctx = engine.ctx;
      var cw = engine.canvas.width;
      var ch = engine.canvas.height;
      
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.font = 'bold 14px Helvetica, Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('@TrenchBabiis', cw - 8, ch - 8);
      ctx.restore();
      
      // Download
      var filename = 'trenchbabiis_pfp.png';
      var a = document.createElement('a');
      a.download = filename;

      if (engine.canvas && engine.canvas.toBlob) {
        engine.canvas.toBlob(function (blob) {
          if (!blob) return;
          var url = URL.createObjectURL(blob);
          a.href = url;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        }, 'image/png');
      } else {
        a.href = engine.canvas.toDataURL('image/png');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      
      engine.requestRender();
      return false;
    };
  }
})();

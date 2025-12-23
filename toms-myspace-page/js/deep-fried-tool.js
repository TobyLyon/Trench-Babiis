(function () {
  function byId(id) {
    return document.getElementById(id);
  }

  var upload = byId('tb-upload');
  var noise = byId('tb-noise');
  var contrast = byId('tb-contrast');
  var sharp = byId('tb-sharp');
  var sat = byId('tb-sat');
  var crush = byId('tb-crush');
  var apply = byId('tb-apply');
  var reset = byId('tb-reset');
  var del = byId('tb-delete');
  var up = byId('tb-up');
  var down = byId('tb-down');
  var download = byId('tb-download');
  var canvas = byId('tb-canvas');

  if (!window.TBGeneratorEngine || !canvas) return;
  var engine = new window.TBGeneratorEngine({
    canvasId: 'tb-canvas',
    traitsRootId: 'tb-traits',
    layersRootId: 'tb-layers'
  });

  function clamp(v) {
    if (v < 0) return 0;
    if (v > 255) return 255;
    return v;
  }

  function contrastFactor(c) {
    // c in -50..50
    return (259 * (c + 255)) / (255 * (259 - c));
  }

  function makeNoisy(v) {
    return (Math.random() * 2 - 1) * v;
  }

  function applySharpen(imgData, amount) {
    var a = (amount / 100) * 0.8;
    if (a <= 0) return imgData;

    var w = imgData.width;
    var h = imgData.height;
    var src = imgData.data;
    var out = new Uint8ClampedArray(src.length);

    function idx(x, y) {
      return (y * w + x) * 4;
    }

    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var i = idx(x, y);

        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
          out[i] = src[i];
          out[i + 1] = src[i + 1];
          out[i + 2] = src[i + 2];
          out[i + 3] = src[i + 3];
          continue;
        }

        var c0 = idx(x, y);
        var l0 = idx(x - 1, y);
        var r0 = idx(x + 1, y);
        var u0 = idx(x, y - 1);
        var d0 = idx(x, y + 1);

        for (var ch = 0; ch < 3; ch++) {
          var val = (1 + 4 * a) * src[c0 + ch] - a * (src[l0 + ch] + src[r0 + ch] + src[u0 + ch] + src[d0 + ch]);
          out[i + ch] = clamp(val);
        }
        out[i + 3] = src[i + 3];
      }
    }

    return new ImageData(out, w, h);
  }

  function applyCompression(imgData, amount) {
    var c = amount / 100;
    if (c <= 0) return imgData;

    var w = imgData.width;
    var h = imgData.height;
    var d = imgData.data;

    // Blockiness / pixelation
    var block = 1 + Math.floor(c * 10);
    if (block > 1) {
      for (var y = 0; y < h; y += block) {
        for (var x = 0; x < w; x += block) {
          var i0 = (y * w + x) * 4;
          var r = d[i0];
          var g = d[i0 + 1];
          var b = d[i0 + 2];
          for (var yy = 0; yy < block && (y + yy) < h; yy++) {
            for (var xx = 0; xx < block && (x + xx) < w; xx++) {
              var ii = ((y + yy) * w + (x + xx)) * 4;
              d[ii] = r;
              d[ii + 1] = g;
              d[ii + 2] = b;
            }
          }
        }
      }
    }

    // Posterize
    var poster = Math.max(6, 48 - Math.floor(c * 40));
    for (var i = 0; i < d.length; i += 4) {
      d[i] = Math.floor(d[i] / poster) * poster;
      d[i + 1] = Math.floor(d[i + 1] / poster) * poster;
      d[i + 2] = Math.floor(d[i + 2] / poster) * poster;
    }

    return imgData;
  }

  function deepFry(imgData) {
    var n = parseInt(noise.value, 10) || 0;
    var c = parseInt(contrast.value, 10) || 0;
    var s = parseInt(sat.value, 10) || 100;
    var sh = parseInt(sharp.value, 10) || 0;
    var comp = parseInt(crush.value, 10) || 0;

    var grain = (n / 100) * 45;
    var cf = contrastFactor(c);
    var satFactor = (s / 100);

    var d = imgData.data;

    for (var i = 0; i < d.length; i += 4) {
      var r = d[i];
      var g = d[i + 1];
      var b = d[i + 2];

      if (grain > 0) {
        var gg = makeNoisy(grain);
        r = clamp(r + gg);
        g = clamp(g + gg);
        b = clamp(b + gg);
      }

      r = clamp(cf * (r - 128) + 128);
      g = clamp(cf * (g - 128) + 128);
      b = clamp(cf * (b - 128) + 128);

      var avg = (r + g + b) / 3;
      r = clamp(avg + (r - avg) * satFactor);
      g = clamp(avg + (g - avg) * satFactor);
      b = clamp(avg + (b - avg) * satFactor);

      // mild warm push for classic fry
      r = clamp(r + 12);
      g = clamp(g + 3);

      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
    }

    imgData = applyCompression(imgData, comp);
    imgData = applySharpen(imgData, sh);

    return imgData;
  }

  engine.setPostProcess(function (imgData) {
    return deepFry(imgData);
  });

  function bindLive(el) {
    if (!el) return;
    el.oninput = function () {
      engine.requestRender();
    };
  }

  bindLive(noise);
  bindLive(contrast);
  bindLive(sharp);
  bindLive(sat);
  bindLive(crush);

  function createWatermark(cb) {
    var c = document.createElement('canvas');
    c.width = 600;
    c.height = 80;
    var cx = c.getContext('2d');

    cx.clearRect(0, 0, c.width, c.height);
    cx.font = 'bold 36px verdana';
    cx.fillStyle = 'rgba(0,0,0,1)';
    cx.strokeStyle = 'rgba(255,255,255,1)';
    cx.lineWidth = 4;
    cx.textBaseline = 'middle';

    var text = '@TRENCHBABIIS';
    cx.strokeText(text, 10, 40);
    cx.fillText(text, 10, 40);

    var img = new Image();
    img.onload = function () { cb(img); };
    img.src = c.toDataURL('image/png');
  }

  function ensureWatermark() {
    for (var i = 0; i < engine.layers.length; i++) {
      if (engine.layers[i].category === 'watermark') return;
    }

    createWatermark(function (img) {
      engine.setImageLayer('watermark', img, '@TRENCHBABIIS');
      for (var j = 0; j < engine.layers.length; j++) {
        if (engine.layers[j].category === 'watermark') {
          engine.layers[j].opacity = 0.6;
          engine.layers[j].locked = true;
          engine.layers[j].scale = 0.55;
          engine.layers[j].rotation = -0.15;
          engine.layers[j].x = engine.canvas.width - 160;
          engine.layers[j].y = engine.canvas.height - 40;
          engine.selectedIndex = j;
          break;
        }
      }
      engine.requestRender();
      if (engine._renderLayersUI) engine._renderLayersUI();
    });
  }

  ensureWatermark();

  function resetAll() {
    if (upload) upload.value = '';
    if (noise) noise.value = 35;
    if (contrast) contrast.value = 20;
    if (sharp) sharp.value = 35;
    if (sat) sat.value = 160;
    if (crush) crush.value = 55;
    engine.clearLayers();
    ensureWatermark();
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
          engine.setImageLayer('upload', img, 'Uploaded Base');
          ensureWatermark();
          upload.value = '';
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    };
  }

  if (apply) {
    apply.onclick = function (e) {
      if (e && e.preventDefault) e.preventDefault();
      engine.requestRender();
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

  if (del) {
    del.onclick = function (e) {
      if (e && e.preventDefault) e.preventDefault();
      engine.deleteSelected();
      ensureWatermark();
      return false;
    };
  }

  if (up) {
    up.onclick = function (e) {
      if (e && e.preventDefault) e.preventDefault();
      engine.moveSelectedUp();
      return false;
    };
  }

  if (down) {
    down.onclick = function (e) {
      if (e && e.preventDefault) e.preventDefault();
      engine.moveSelectedDown();
      return false;
    };
  }

  if (download) {
    download.onclick = function (e) {
      if (e && e.preventDefault) e.preventDefault();
      engine.download('trenchbabii_deepfried.png');
      return false;
    };
  }
})();

(function () {
  'use strict';

  function byId(id) { return document.getElementById(id); }

  // Elements
  var canvas = byId('tb-canvas');
  var upload = byId('tb-upload');
  var noise = byId('tb-noise');
  var contrast = byId('tb-contrast');
  var sharp = byId('tb-sharp');
  var sat = byId('tb-sat');
  var crush = byId('tb-crush');
  var reset = byId('tb-reset');
  var download = byId('tb-download');
  var textTop = byId('tb-text-top');
  var textBottom = byId('tb-text-bottom');
  var fontSelect = byId('tb-font');
  var textSize = byId('tb-text-size');
  var wmSize = byId('tb-wm-size');
  var wmRot = byId('tb-wm-rot');

  // Value displays
  var noiseVal = byId('tb-noise-val');
  var contrastVal = byId('tb-contrast-val');
  var sharpVal = byId('tb-sharp-val');
  var satVal = byId('tb-sat-val');
  var crushVal = byId('tb-crush-val');
  var textSizeVal = byId('tb-text-size-val');
  var wmSizeVal = byId('tb-wm-size-val');
  var wmRotVal = byId('tb-wm-rot-val');

  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var cw = canvas.width;
  var ch = canvas.height;

  // State
  var baseImage = null;
  var watermark = { x: cw / 2, y: ch - 40, scale: 1 };
  var isDragging = false;
  var dragOffset = { x: 0, y: 0 };

  // Utility
  function clamp(v, min, max) {
    if (min === undefined) { min = 0; max = 255; }
    return Math.max(min, Math.min(max, v));
  }

  function updateDisplays() {
    if (noiseVal && noise) noiseVal.textContent = noise.value;
    if (contrastVal && contrast) contrastVal.textContent = contrast.value;
    if (sharpVal && sharp) sharpVal.textContent = sharp.value;
    if (satVal && sat) satVal.textContent = sat.value;
    if (crushVal && crush) crushVal.textContent = crush.value;
    if (textSizeVal && textSize) textSizeVal.textContent = textSize.value;
    if (wmSizeVal && wmSize) wmSizeVal.textContent = wmSize.value;
    if (wmRotVal && wmRot) wmRotVal.textContent = wmRot.value;
  }

  // Deep fry processing
  function contrastFactor(c) {
    return (259 * (c + 255)) / (255 * (259 - c));
  }

  function deepFry(imgData) {
    var n = noise ? parseInt(noise.value, 10) : 35;
    var c = contrast ? parseInt(contrast.value, 10) : 20;
    var s = sat ? parseInt(sat.value, 10) : 160;
    var sh = sharp ? parseInt(sharp.value, 10) : 35;
    var comp = crush ? parseInt(crush.value, 10) : 55;

    var grain = (n / 100) * 45;
    var cf = contrastFactor(c);
    var satFactor = s / 100;
    var d = imgData.data;
    var w = imgData.width;
    var h = imgData.height;

    // Apply noise, contrast, saturation
    for (var i = 0; i < d.length; i += 4) {
      var r = d[i], g = d[i + 1], b = d[i + 2];

      if (grain > 0) {
        var gg = (Math.random() * 2 - 1) * grain;
        r = clamp(r + gg); g = clamp(g + gg); b = clamp(b + gg);
      }

      r = clamp(cf * (r - 128) + 128);
      g = clamp(cf * (g - 128) + 128);
      b = clamp(cf * (b - 128) + 128);

      var avg = (r + g + b) / 3;
      r = clamp(avg + (r - avg) * satFactor);
      g = clamp(avg + (g - avg) * satFactor);
      b = clamp(avg + (b - avg) * satFactor);

      r = clamp(r + 12); g = clamp(g + 3);

      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }

    // Compression / blockiness
    var block = 1 + Math.floor((comp / 100) * 10);
    if (block > 1) {
      for (var y = 0; y < h; y += block) {
        for (var x = 0; x < w; x += block) {
          var i0 = (y * w + x) * 4;
          var rr = d[i0], gg = d[i0 + 1], bb = d[i0 + 2];
          for (var yy = 0; yy < block && (y + yy) < h; yy++) {
            for (var xx = 0; xx < block && (x + xx) < w; xx++) {
              var ii = ((y + yy) * w + (x + xx)) * 4;
              d[ii] = rr; d[ii + 1] = gg; d[ii + 2] = bb;
            }
          }
        }
      }
    }

    // Posterize
    var poster = Math.max(6, 48 - Math.floor((comp / 100) * 40));
    for (var j = 0; j < d.length; j += 4) {
      d[j] = Math.floor(d[j] / poster) * poster;
      d[j + 1] = Math.floor(d[j + 1] / poster) * poster;
      d[j + 2] = Math.floor(d[j + 2] / poster) * poster;
    }

    // Sharpen
    if (sh > 0) {
      var a = (sh / 100) * 0.8;
      var src = new Uint8ClampedArray(d);
      for (var yy = 1; yy < h - 1; yy++) {
        for (var xx = 1; xx < w - 1; xx++) {
          var idx = (yy * w + xx) * 4;
          for (var ch = 0; ch < 3; ch++) {
            var val = (1 + 4 * a) * src[idx + ch]
              - a * (src[idx - 4 + ch] + src[idx + 4 + ch] + src[idx - w * 4 + ch] + src[idx + w * 4 + ch]);
            d[idx + ch] = clamp(val);
          }
        }
      }
    }

    return imgData;
  }

  function drawMemeText(ctx) {
    var top = textTop ? textTop.value.toUpperCase() : '';
    var bottom = textBottom ? textBottom.value.toUpperCase() : '';
    var font = fontSelect ? fontSelect.value : 'Impact';
    var size = textSize ? parseInt(textSize.value, 10) : 42;

    if (!top && !bottom) return;

    ctx.save();
    ctx.font = 'bold ' + size + 'px ' + font;
    ctx.textAlign = 'center';
    ctx.lineWidth = Math.max(2, size / 10);
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#fff';

    if (top) {
      ctx.textBaseline = 'top';
      ctx.strokeText(top, cw / 2, 12);
      ctx.fillText(top, cw / 2, 12);
    }
    if (bottom) {
      ctx.textBaseline = 'bottom';
      ctx.strokeText(bottom, cw / 2, ch - 12);
      ctx.fillText(bottom, cw / 2, ch - 12);
    }
    ctx.restore();
  }

  function drawWatermark(ctx) {
    var scale = wmSize ? parseInt(wmSize.value, 10) / 100 : 1;
    watermark.scale = scale;

    var rotDeg = wmRot ? parseInt(wmRot.value, 10) : 0;
    watermark.rot = rotDeg;
    var rotRad = (rotDeg * Math.PI) / 180;

    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.translate(watermark.x, watermark.y);
    ctx.rotate(rotRad);
    ctx.font = 'bold ' + Math.round(28 * scale) + 'px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('@TRENCHBABIIS', 0, 0);
    ctx.restore();
  }

  function getWatermarkBounds() {
    var scale = watermark.scale || 1;
    var textWidth = 180 * scale;
    var textHeight = 30 * scale;
    return {
      x: watermark.x - textWidth / 2,
      y: watermark.y - textHeight / 2,
      w: textWidth,
      h: textHeight
    };
  }

  function getWatermarkRotRad() {
    var deg = typeof watermark.rot === 'number' ? watermark.rot : (wmRot ? parseInt(wmRot.value, 10) : 0);
    return (deg * Math.PI) / 180;
  }

  function render() {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, cw, ch);

    if (baseImage) {
      var scale = Math.min(cw / baseImage.width, ch / baseImage.height);
      var w = baseImage.width * scale;
      var h = baseImage.height * scale;
      var x = (cw - w) / 2;
      var y = (ch - h) / 2;
      ctx.drawImage(baseImage, x, y, w, h);

      var imgData = ctx.getImageData(0, 0, cw, ch);
      imgData = deepFry(imgData);
      ctx.putImageData(imgData, 0, 0);
    }

    drawMemeText(ctx);
    drawWatermark(ctx);
  }

  function requestRender() {
    requestAnimationFrame(render);
  }

  // Mouse/touch handling for watermark drag
  function getCanvasPos(e) {
    var rect = canvas.getBoundingClientRect();
    var clientX = e.touches ? e.touches[0].clientX : e.clientX;
    var clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (cw / rect.width),
      y: (clientY - rect.top) * (ch / rect.height)
    };
  }

  function isInWatermark(pos) {
    var b = getWatermarkBounds();
    var dx = pos.x - watermark.x;
    var dy = pos.y - watermark.y;
    var a = -getWatermarkRotRad();
    var cos = Math.cos(a);
    var sin = Math.sin(a);
    var lx = dx * cos - dy * sin;
    var ly = dx * sin + dy * cos;
    return Math.abs(lx) <= b.w / 2 && Math.abs(ly) <= b.h / 2;
  }

  canvas.addEventListener('mousedown', function (e) {
    var pos = getCanvasPos(e);
    if (isInWatermark(pos)) {
      isDragging = true;
      dragOffset.x = pos.x - watermark.x;
      dragOffset.y = pos.y - watermark.y;
      canvas.style.cursor = 'grabbing';
    }
  });

  canvas.addEventListener('mousemove', function (e) {
    var pos = getCanvasPos(e);
    if (isDragging) {
      watermark.x = clamp(pos.x - dragOffset.x, 50, cw - 50);
      watermark.y = clamp(pos.y - dragOffset.y, 20, ch - 20);
      requestRender();
    } else {
      canvas.style.cursor = isInWatermark(pos) ? 'grab' : 'default';
    }
  });

  canvas.addEventListener('mouseup', function () {
    isDragging = false;
    canvas.style.cursor = 'default';
  });

  canvas.addEventListener('mouseleave', function () {
    isDragging = false;
  });

  // Touch support
  canvas.addEventListener('touchstart', function (e) {
    var pos = getCanvasPos(e);
    if (isInWatermark(pos)) {
      isDragging = true;
      dragOffset.x = pos.x - watermark.x;
      dragOffset.y = pos.y - watermark.y;
      e.preventDefault();
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', function (e) {
    if (isDragging) {
      var pos = getCanvasPos(e);
      watermark.x = clamp(pos.x - dragOffset.x, 50, cw - 50);
      watermark.y = clamp(pos.y - dragOffset.y, 20, ch - 20);
      requestRender();
      e.preventDefault();
    }
  }, { passive: false });

  canvas.addEventListener('touchend', function () {
    isDragging = false;
  });

  // Bind controls
  function bindControl(el) {
    if (!el) return;
    el.addEventListener('input', function () {
      updateDisplays();
      requestRender();
    });
  }

  bindControl(noise);
  bindControl(contrast);
  bindControl(sharp);
  bindControl(sat);
  bindControl(crush);
  bindControl(textTop);
  bindControl(textBottom);
  bindControl(fontSelect);
  bindControl(textSize);
  bindControl(wmSize);
  bindControl(wmRot);

  // File upload
  if (upload) {
    upload.addEventListener('change', function () {
      var file = upload.files && upload.files[0];
      if (!file) return;

      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          baseImage = img;
          requestRender();
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Reset
  if (reset) {
    reset.addEventListener('click', function (e) {
      e.preventDefault();
      baseImage = null;
      if (upload) upload.value = '';
      if (noise) noise.value = 35;
      if (contrast) contrast.value = 20;
      if (sharp) sharp.value = 35;
      if (sat) sat.value = 160;
      if (crush) crush.value = 55;
      if (textTop) textTop.value = '';
      if (textBottom) textBottom.value = '';
      if (fontSelect) fontSelect.selectedIndex = 0;
      if (textSize) textSize.value = 42;
      if (wmSize) wmSize.value = 100;
      if (wmRot) wmRot.value = 0;
      watermark.x = cw / 2;
      watermark.y = ch - 40;
      watermark.rot = 0;
      updateDisplays();
      requestRender();
    });
  }

  // Download
  if (download) {
    download.addEventListener('click', function (e) {
      e.preventDefault();
      render();
      var filename = 'trenchbabiis_meme.png';
      var link = document.createElement('a');
      link.download = filename;

      if (canvas.toBlob) {
        canvas.toBlob(function (blob) {
          if (!blob) return;
          var url = URL.createObjectURL(blob);
          link.href = url;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        }, 'image/png');
      } else {
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
  }

  // Initial render
  updateDisplays();
  requestRender();
})();

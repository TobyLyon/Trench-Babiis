(function () {
  function byId(id) {
    return document.getElementById(id);
  }

  function createEl(tag) {
    return document.createElement(tag);
  }

  function prettyLabel(name) {
    if (!name) return '';
    var s = String(name);
    s = s.replace(/[_-]+/g, ' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function clamp(v, min, max) {
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  function dist(a, b) {
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function getMousePos(canvas, e) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function loadImg(src, cb) {
    var img = new Image();
    img.onload = function () {
      cb(null, img);
    };
    img.onerror = function () {
      cb(new Error('load failed'), null);
    };
    img.src = src;
  }

  function makeLayer(opts) {
    return {
      id: opts.id,
      category: opts.category,
      name: opts.name,
      src: opts.src,
      img: opts.img,
      x: opts.x,
      y: opts.y,
      scale: opts.scale,
      rotation: opts.rotation,
      opacity: typeof opts.opacity === 'number' ? opts.opacity : 1,
      locked: !!opts.locked,
      w: opts.w,
      h: opts.h
    };
  }

  function TBGeneratorEngine(options) {
    this.options = options || {};

    this.canvas = byId(this.options.canvasId);
    this.traitsRoot = byId(this.options.traitsRootId);
    this.layersRoot = this.options.layersRootId ? byId(this.options.layersRootId) : null;
    this.manifestUrl = this.options.manifestUrl || 'assets/manifest.json';
    this.backgroundColor = this.options.backgroundColor || '#ffffff';

    this.layers = [];
    this.selectedIndex = -1;
    this.selectedTraits = {};
    this._nextId = 1;

    this._drag = null;
    this._needsRender = true;

    this.postProcess = null;
    this.maskCircle = false;
    this.transparentBackground = false;

    this.transformsEnabled = (this.options.transformsEnabled !== false);
    this.fitScaleFactor = (typeof this.options.fitScaleFactor === 'number') ? this.options.fitScaleFactor : 0.8;

    this.layerOrder = Array.isArray(this.options.layerOrder) ? this.options.layerOrder.slice() : null;
    this._layerOrderMap = null;
    if (this.layerOrder && this.layerOrder.length) {
      this._layerOrderMap = {};
      for (var oi = 0; oi < this.layerOrder.length; oi++) {
        this._layerOrderMap[String(this.layerOrder[oi])] = oi;
      }
    }

    if (!this.canvas || !this.canvas.getContext) {
      return;
    }

    this.ctx = this.canvas.getContext('2d');
    this.buffer = document.createElement('canvas');
    this.buffer.width = this.canvas.width;
    this.buffer.height = this.canvas.height;
    this.bctx = this.buffer.getContext('2d');

    this._maskCanvas = document.createElement('canvas');
    this._maskCanvas.width = this.canvas.width;
    this._maskCanvas.height = this.canvas.height;
    this._maskCtx = this._maskCanvas.getContext('2d');

    this._attachCanvasEvents();
    this._loop();
    this._loadManifest();
  }

  TBGeneratorEngine.prototype._categoryOrderIndex = function (category) {
    if (!this._layerOrderMap || !category) return 9999;
    var k = String(category);
    if (this._layerOrderMap.hasOwnProperty(k)) return this._layerOrderMap[k];
    return 9999;
  };

  TBGeneratorEngine.prototype._sortLayersIfNeeded = function () {
    if (!this._layerOrderMap || !this.layers || this.layers.length < 2) return;

    var selectedId = null;
    if (this.selectedIndex >= 0 && this.layers[this.selectedIndex]) {
      selectedId = this.layers[this.selectedIndex].id;
    }

    var self = this;
    this.layers.sort(function (a, b) {
      var ai = self._categoryOrderIndex(a && a.category);
      var bi = self._categoryOrderIndex(b && b.category);
      if (ai !== bi) return ai - bi;
      var aid = a && typeof a.id === 'number' ? a.id : 0;
      var bid = b && typeof b.id === 'number' ? b.id : 0;
      return aid - bid;
    });

    if (selectedId !== null) {
      for (var i = 0; i < this.layers.length; i++) {
        if (this.layers[i] && this.layers[i].id === selectedId) {
          this.selectedIndex = i;
          break;
        }
      }
    }
  };

  TBGeneratorEngine.prototype.setTransformsEnabled = function (enabled) {
    this.transformsEnabled = !!enabled;
    if (!this.transformsEnabled) this._drag = null;
    this.requestRender();
  };

  TBGeneratorEngine.prototype._setTraitActive = function (category, src) {
    if (!this.traitsRoot || !category) return;
    if (!this.selectedTraits) this.selectedTraits = {};
    if (src) this.selectedTraits[category] = src;

    var links = this.traitsRoot.querySelectorAll('.tb-asset[data-category]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.getAttribute('data-category') !== category) continue;
      var isActive = (a.getAttribute('data-src') || '') === (src || '');
      if (isActive) a.classList.add('tb-asset-selected');
      else a.classList.remove('tb-asset-selected');
    }
  };

  TBGeneratorEngine.prototype.setImageLayer = function (category, img, name) {
    if (!category || !img) return;
    this._setLayerForCategory(category, img, null, name || category);
  };

  TBGeneratorEngine.prototype._loop = function () {
    var self = this;
    function tick() {
      if (self._needsRender) {
        self._needsRender = false;
        self._render();
      }
      window.requestAnimationFrame(tick);
    }
    window.requestAnimationFrame(tick);
  };

  TBGeneratorEngine.prototype.requestRender = function () {
    this._needsRender = true;
  };

  TBGeneratorEngine.prototype.setMaskCircle = function (enabled) {
    this.maskCircle = !!enabled;
    this.requestRender();
  };

  TBGeneratorEngine.prototype.setTransparentBackground = function (enabled) {
    this.transparentBackground = !!enabled;
    this.requestRender();
  };

  TBGeneratorEngine.prototype.setPostProcess = function (fn) {
    this.postProcess = fn;
    this.requestRender();
  };

  TBGeneratorEngine.prototype.clearLayers = function () {
    this.layers = [];
    this.selectedIndex = -1;
    this.selectedTraits = {};
    this.requestRender();
    this._renderLayersUI();
  };

  TBGeneratorEngine.prototype.deleteSelected = function () {
    if (this.selectedIndex < 0 || this.selectedIndex >= this.layers.length) return;
    if (this.layers[this.selectedIndex] && this.layers[this.selectedIndex].locked) return;
    this.layers.splice(this.selectedIndex, 1);
    this.selectedIndex = this.layers.length - 1;
    this.requestRender();
    this._renderLayersUI();
  };

  TBGeneratorEngine.prototype.moveSelectedUp = function () {
    var i = this.selectedIndex;
    if (i < 0 || i >= this.layers.length - 1) return;
    if (this.layers[i] && this.layers[i].locked) return;
    if (this.layers[i + 1] && this.layers[i + 1].locked) return;
    var tmp = this.layers[i];
    this.layers[i] = this.layers[i + 1];
    this.layers[i + 1] = tmp;
    this.selectedIndex = i + 1;
    this.requestRender();
    this._renderLayersUI();
  };

  TBGeneratorEngine.prototype.moveSelectedDown = function () {
    var i = this.selectedIndex;
    if (i <= 0 || i >= this.layers.length) return;
    if (this.layers[i] && this.layers[i].locked) return;
    if (this.layers[i - 1] && this.layers[i - 1].locked) return;
    var tmp = this.layers[i];
    this.layers[i] = this.layers[i - 1];
    this.layers[i - 1] = tmp;
    this.selectedIndex = i - 1;
    this.requestRender();
    this._renderLayersUI();
  };

  TBGeneratorEngine.prototype.download = function (filename) {
    this._render(true);
    var href;
    try {
      href = this.canvas.toDataURL('image/png');
    } catch (e) {
      try { console.error(e); } catch (err) {}
      alert('Export failed (browser blocked canvas export). If you used an external image, try downloading it and uploading the file instead.');
      this.requestRender();
      return;
    }

    var a = document.createElement('a');
    a.download = filename || 'trenchbabiis.png';
    a.href = href;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    this.requestRender();
  };

  TBGeneratorEngine.prototype._loadManifest = function () {
    var self = this;
    if (!this.traitsRoot) return;

    if (window.TB_ASSET_MANIFEST && window.TB_ASSET_MANIFEST.categories) {
      self.manifest = window.TB_ASSET_MANIFEST;
      self._renderTraitsUI();
      return;
    }

    fetch(this.manifestUrl)
      .then(function (r) {
        return r.json();
      })
      .then(function (m) {
        self.manifest = m;
        self._renderTraitsUI();
      })
      .catch(function () {
        self.traitsRoot.innerHTML = '<p><b>Asset system offline.</b> Missing assets/manifest.json</p>';
      });
  };

  TBGeneratorEngine.prototype._renderTraitsUI = function () {
    if (!this.traitsRoot) return;

    var self = this;
    this.traitsRoot.innerHTML = '';

    if (!this.manifest || !this.manifest.categories || !this.manifest.categories.length) {
      this.traitsRoot.innerHTML = '<p><b>No categories detected.</b></p>';
      return;
    }

    var cats = this.manifest.categories;
    if (this._layerOrderMap && cats && cats.length) {
      var self = this;
      cats = cats.slice().sort(function (a, b) {
        var ai = self._categoryOrderIndex(a && a.name);
        var bi = self._categoryOrderIndex(b && b.name);
        if (ai !== bi) return ai - bi;
        return 0;
      });
    }
    var i;
    for (i = 0; i < cats.length; i++) {
      (function (cat) {
        var table = createEl('table');
        table.className = 'tb-tool-table tb-trait-category';

        var tr1 = createEl('tr');
        var th = createEl('th');
        th.setAttribute('scope', 'col');
        th.appendChild(document.createTextNode(prettyLabel(cat.name)));
        tr1.appendChild(th);
        table.appendChild(tr1);

        var tr2 = createEl('tr');
        var td = createEl('td');

        if (!cat.items || !cat.items.length) {
          var empty = createEl('div');
          empty.className = 'tb-trait-empty';
          empty.appendChild(document.createTextNode('No assets found.'));
          td.appendChild(empty);
        } else {
          var grid = createEl('div');
          grid.className = 'tb-trait-grid';

          var activeSrc = null;
          if (self.selectedTraits && self.selectedTraits[cat.name]) {
            activeSrc = self.selectedTraits[cat.name];
          } else {
            for (var k = 0; k < self.layers.length; k++) {
              if (self.layers[k] && self.layers[k].category === cat.name && self.layers[k].src) {
                activeSrc = self.layers[k].src;
                break;
              }
            }
          }

          var j;
          for (j = 0; j < cat.items.length; j++) {
            (function (item, index) {
              var a = createEl('a');
              a.href = '#';
              a.className = 'tb-asset' + (activeSrc && item.src === activeSrc ? ' tb-asset-selected' : '');
              a.setAttribute('data-category', cat.name);
              a.setAttribute('data-src', item.src);
              a.setAttribute('data-name', item.name || item.src);

              var img = createEl('img');
              img.className = 'tb-asset-thumb';
              img.src = item.src;
              img.alt = item.name || '';

              var label = createEl('span');
              label.className = 'tb-asset-label';
              label.appendChild(document.createTextNode(item.name || ('Asset ' + (index + 1))));

              a.appendChild(img);
              a.appendChild(label);

              a.onclick = function (e) {
                if (e && e.preventDefault) e.preventDefault();
                self.setCategoryAsset(cat.name, item.src, item.name || item.src);
                self._setTraitActive(cat.name, item.src);
                return false;
              };

              grid.appendChild(a);
            })(cat.items[j], j);
          }

          td.appendChild(grid);
        }

        tr2.appendChild(td);
        table.appendChild(tr2);
        self.traitsRoot.appendChild(table);
      })(cats[i]);
    }

    this._renderLayersUI();
  };

  TBGeneratorEngine.prototype._renderLayersUI = function () {
    if (!this.layersRoot) return;

    this.layersRoot.innerHTML = '';

    var table = createEl('table');
    table.className = 'tb-tool-table';

    var tr1 = createEl('tr');
    var th = createEl('th');
    th.setAttribute('scope', 'col');
    th.appendChild(document.createTextNode('Layers'));
    tr1.appendChild(th);
    table.appendChild(tr1);

    var tr2 = createEl('tr');
    var td = createEl('td');

    if (!this.layers.length) {
      td.appendChild(document.createTextNode('No layers. Select an asset.'));
    } else {
      for (var i = this.layers.length - 1; i >= 0; i--) {
        var l = this.layers[i];
        var a = createEl('a');
        a.href = '#';
        a.className = 'tb-track' + (i === this.selectedIndex ? ' tb-track-selected' : '');
        a.appendChild(document.createTextNode(prettyLabel(l.category) + ': ' + l.name + (l.locked ? ' (LOCKED)' : '')));
        a.setAttribute('data-index', String(i));

        var self = this;
        a.onclick = function (e) {
          if (e && e.preventDefault) e.preventDefault();
          var idx = parseInt(this.getAttribute('data-index'), 10);
          if (!isNaN(idx)) {
            self.selectedIndex = idx;
            self.requestRender();
            self._renderLayersUI();
          }
          return false;
        };

        td.appendChild(a);
      }
    }

    tr2.appendChild(td);
    table.appendChild(tr2);
    this.layersRoot.appendChild(table);
  };

  TBGeneratorEngine.prototype.setCategoryAsset = function (category, src, name) {
    var self = this;
    if (!category || !src) return;

    loadImg(src, function (err, img) {
      if (err) return;

      self._setLayerForCategory(category, img, src, name || src);
    });
  };

  TBGeneratorEngine.prototype._setLayerForCategory = function (category, img, src, name) {
    var i;
    var existingIndex = -1;
    for (i = 0; i < this.layers.length; i++) {
      if (this.layers[i].category === category) {
        existingIndex = i;
        break;
      }
    }

    var cw = this.canvas.width;
    var ch = this.canvas.height;

    var scale = 1;
    var maxDim = Math.max(img.width, img.height);
    if (maxDim > 0) {
      scale = Math.min(cw / img.width, ch / img.height);
    }
    scale = scale * this.fitScaleFactor;

    var layer = makeLayer({
      id: this._nextId++,
      category: category,
      name: name || category,
      src: src || null,
      img: img,
      x: cw / 2,
      y: ch / 2,
      scale: scale,
      rotation: 0,
      opacity: 1,
      locked: false,
      w: img.width,
      h: img.height
    });

    if (existingIndex >= 0) {
      this.layers[existingIndex] = layer;
      this.selectedIndex = existingIndex;
    } else {
      this.layers.push(layer);
      this.selectedIndex = this.layers.length - 1;
    }

    this._sortLayersIfNeeded();

    if (!this.selectedTraits) this.selectedTraits = {};
    if (src) this.selectedTraits[category] = src;

    this._setTraitActive(category, src);

    this.requestRender();
    this._renderLayersUI();
  };

  TBGeneratorEngine.prototype._render = function (force) {
    if (!this.bctx || !this.ctx) return;

    var cw = this.canvas.width;
    var ch = this.canvas.height;

    // Clear canvas - use transparent if enabled, otherwise fill with background color
    this.bctx.clearRect(0, 0, cw, ch);
    if (!this.transparentBackground) {
      this.bctx.fillStyle = this.backgroundColor;
      this.bctx.fillRect(0, 0, cw, ch);
    }

    for (var i = 0; i < this.layers.length; i++) {
      if (this.layers[i] && this.layers[i].locked) continue;
      this._drawLayer(this.bctx, this.layers[i]);
    }

    for (var j = 0; j < this.layers.length; j++) {
      if (!this.layers[j] || !this.layers[j].locked) continue;
      this._drawLayer(this.bctx, this.layers[j]);
    }

    if (this.maskCircle) {
      this._maskCtx.fillStyle = this.backgroundColor;
      this._maskCtx.fillRect(0, 0, cw, ch);

      this._maskCtx.save();
      this._maskCtx.beginPath();
      this._maskCtx.arc(cw / 2, ch / 2, Math.floor(Math.min(cw, ch) / 2) - 2, 0, Math.PI * 2, true);
      this._maskCtx.closePath();
      this._maskCtx.clip();
      this._maskCtx.drawImage(this.buffer, 0, 0);
      this._maskCtx.restore();

      this.bctx.fillStyle = this.backgroundColor;
      this.bctx.fillRect(0, 0, cw, ch);
      this.bctx.drawImage(this._maskCanvas, 0, 0);
    }

    if (this.postProcess) {
      try {
        var imgData = this.bctx.getImageData(0, 0, cw, ch);
        var out = this.postProcess(imgData, this);
        if (out && out.data) {
          this.bctx.putImageData(out, 0, 0);
        }
      } catch (e) {
      }
    }

    this.ctx.drawImage(this.buffer, 0, 0);

    if (!force && this.transformsEnabled && this.selectedIndex >= 0 && this.layers[this.selectedIndex]) {
      this._drawHandles(this.ctx, this.layers[this.selectedIndex]);
    }
  };

  TBGeneratorEngine.prototype._drawLayer = function (ctx, layer) {
    if (!layer || !layer.img) return;

    ctx.save();
    ctx.globalAlpha = typeof layer.opacity === 'number' ? layer.opacity : 1;
    ctx.translate(layer.x, layer.y);
    ctx.rotate(layer.rotation);
    ctx.scale(layer.scale, layer.scale);
    ctx.drawImage(layer.img, -layer.w / 2, -layer.h / 2, layer.w, layer.h);
    ctx.restore();
  };

  TBGeneratorEngine.prototype._getCorners = function (layer) {
    var hw = (layer.w / 2) * layer.scale;
    var hh = (layer.h / 2) * layer.scale;

    var cos = Math.cos(layer.rotation);
    var sin = Math.sin(layer.rotation);

    function rot(dx, dy) {
      return {
        x: layer.x + dx * cos - dy * sin,
        y: layer.y + dx * sin + dy * cos
      };
    }

    var tl = rot(-hw, -hh);
    var tr = rot(hw, -hh);
    var br = rot(hw, hh);
    var bl = rot(-hw, hh);
    var top = rot(0, -hh);
    var rotHandle = rot(0, -hh - 24);

    return {
      tl: tl,
      tr: tr,
      br: br,
      bl: bl,
      top: top,
      rot: rotHandle
    };
  };

  TBGeneratorEngine.prototype._drawHandles = function (ctx, layer) {
    var c = this._getCorners(layer);

    ctx.save();
    ctx.strokeStyle = 'rgb(255, 153, 51)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(c.tl.x, c.tl.y);
    ctx.lineTo(c.tr.x, c.tr.y);
    ctx.lineTo(c.br.x, c.br.y);
    ctx.lineTo(c.bl.x, c.bl.y);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(c.top.x, c.top.y);
    ctx.lineTo(c.rot.x, c.rot.y);
    ctx.stroke();

    function drawBox(p) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
      ctx.strokeRect(p.x - 4, p.y - 4, 8, 8);
    }

    drawBox(c.tl);
    drawBox(c.tr);
    drawBox(c.br);
    drawBox(c.bl);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(c.rot.x, c.rot.y, 5, 0, Math.PI * 2, true);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  };

  TBGeneratorEngine.prototype._hitTestLayer = function (layer, p) {
    var dx = p.x - layer.x;
    var dy = p.y - layer.y;

    var cos = Math.cos(-layer.rotation);
    var sin = Math.sin(-layer.rotation);

    var lx = dx * cos - dy * sin;
    var ly = dx * sin + dy * cos;

    lx = lx / layer.scale;
    ly = ly / layer.scale;

    return (lx >= -layer.w / 2 && lx <= layer.w / 2 && ly >= -layer.h / 2 && ly <= layer.h / 2);
  };

  TBGeneratorEngine.prototype._hitTestHandle = function (layer, p) {
    var c = this._getCorners(layer);
    var handles = [
      { name: 'scale', p: c.tl },
      { name: 'scale', p: c.tr },
      { name: 'scale', p: c.br },
      { name: 'scale', p: c.bl },
      { name: 'rotate', p: c.rot }
    ];

    for (var i = 0; i < handles.length; i++) {
      if (dist(handles[i].p, p) <= 8) {
        return handles[i];
      }
    }
    return null;
  };

  TBGeneratorEngine.prototype._attachCanvasEvents = function () {
    var self = this;

    this.canvas.onmousedown = function (e) {
      var p = getMousePos(self.canvas, e);

      if (!self.transformsEnabled) {
        for (var i0 = self.layers.length - 1; i0 >= 0; i0--) {
          if (self._hitTestLayer(self.layers[i0], p)) {
            self.selectedIndex = i0;
            self.requestRender();
            self._renderLayersUI();
            return;
          }
        }
        self.selectedIndex = -1;
        self.requestRender();
        self._renderLayersUI();
        return;
      }

      if (self.selectedIndex >= 0 && self.layers[self.selectedIndex]) {
        var sel = self.layers[self.selectedIndex];
        var h = self._hitTestHandle(sel, p);
        if (h) {
          if (h.name === 'rotate') {
            self._drag = {
              mode: 'rotate',
              layerIndex: self.selectedIndex,
              startAngle: Math.atan2(p.y - sel.y, p.x - sel.x),
              startRotation: sel.rotation
            };
            return;
          }

          if (h.name === 'scale') {
            self._drag = {
              mode: 'scale',
              layerIndex: self.selectedIndex,
              startDist: dist({ x: sel.x, y: sel.y }, p),
              startScale: sel.scale
            };
            return;
          }
        }

        if (self._hitTestLayer(sel, p)) {
          self._drag = {
            mode: 'move',
            layerIndex: self.selectedIndex,
            offsetX: sel.x - p.x,
            offsetY: sel.y - p.y
          };
          return;
        }
      }

      for (var i = self.layers.length - 1; i >= 0; i--) {
        if (self._hitTestLayer(self.layers[i], p)) {
          self.selectedIndex = i;
          self._drag = {
            mode: 'move',
            layerIndex: i,
            offsetX: self.layers[i].x - p.x,
            offsetY: self.layers[i].y - p.y
          };
          self.requestRender();
          self._renderLayersUI();
          return;
        }
      }

      self.selectedIndex = -1;
      self.requestRender();
      self._renderLayersUI();
    };

    this.canvas.onmousemove = function (e) {
      if (!self.transformsEnabled) return;
      if (!self._drag) return;

      var p = getMousePos(self.canvas, e);
      var d = self._drag;
      var layer = self.layers[d.layerIndex];
      if (!layer) return;

      if (d.mode === 'move') {
        layer.x = p.x + d.offsetX;
        layer.y = p.y + d.offsetY;
        self.requestRender();
        return;
      }

      if (d.mode === 'rotate') {
        var a = Math.atan2(p.y - layer.y, p.x - layer.x);
        layer.rotation = d.startRotation + (a - d.startAngle);
        self.requestRender();
        return;
      }

      if (d.mode === 'scale') {
        var nd = dist({ x: layer.x, y: layer.y }, p);
        var ratio = 1;
        if (d.startDist > 1) ratio = nd / d.startDist;
        layer.scale = clamp(d.startScale * ratio, 0.05, 20);
        self.requestRender();
        return;
      }
    };

    window.onmouseup = function () {
      if (!self.transformsEnabled) return;
      if (!self._drag) return;
      self._drag = null;
      self.requestRender();
    };
  };

  window.TBGeneratorEngine = TBGeneratorEngine;
})();

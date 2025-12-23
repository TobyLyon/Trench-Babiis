(function () {
  function byId(id) {
    return document.getElementById(id);
  }

  var upload = byId('tb-upload');
  var random = byId('tb-random');
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

  engine.setPostProcess(null);
  engine.setMaskCircle(false);

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
          engine.setImageLayer('upload', img, 'Uploaded Base');
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

  if (del) {
    del.onclick = function (e) {
      if (e && e.preventDefault) e.preventDefault();
      engine.deleteSelected();
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
      engine.download('trenchbabii_pfp.png');
      return false;
    };
  }
})();

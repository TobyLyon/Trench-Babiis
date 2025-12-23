(function () {
  function byId(id) {
    return document.getElementById(id);
  }

  var audio = byId('tb-audio');
  var play = byId('tb-play');
  var stop = byId('tb-stop');
  var nowPlaying = byId('tb-now-playing');
  var tracks = document.getElementsByClassName('tb-track');

  if (!audio || !play || !stop) {
    return;
  }

  function setPlayLabel(isPlaying) {
    play.innerHTML = isPlaying ? 'PAUSE' : 'PLAY';
  }

  function safePlay() {
    var p = audio.play();
    if (p && typeof p.catch === 'function') {
      p.catch(function () {
        if (nowPlaying) {
          nowPlaying.innerHTML = 'TrenchBabii - Audio file missing (put MP3 in /audio)';
        }
      });
    }
  }

  function setNowPlaying(title) {
    if (!nowPlaying) return;
    nowPlaying.innerHTML = title || 'TrenchBabii - (no track loaded)';
  }

  function loadTrackFromEl(el) {
    if (!el) return;
    var src = el.getAttribute('data-src');
    var title = el.getAttribute('data-title') || el.innerHTML;

    if (src) {
      audio.setAttribute('src', src);
      audio.load();
    }

    setNowPlaying(title);
  }

  function markSelected(el) {
    var i;
    for (i = 0; i < tracks.length; i++) {
      tracks[i].className = tracks[i].className.replace(' tb-track-selected', '');
    }

    if (el && el.className.indexOf('tb-track-selected') === -1) {
      el.className = el.className + ' tb-track-selected';
    }
  }

  if (tracks && tracks.length) {
    (function () {
      var i;
      for (i = 0; i < tracks.length; i++) {
        tracks[i].onclick = function (e) {
          if (e && e.preventDefault) e.preventDefault();
          loadTrackFromEl(this);
          markSelected(this);
          setPlayLabel(false);
          return false;
        };
      }
    })();
  }

  play.onclick = function (e) {
    if (e && e.preventDefault) e.preventDefault();

    if (audio.paused) {
      safePlay();
      setPlayLabel(true);
      return false;
    }

    audio.pause();
    setPlayLabel(false);
    return false;
  };

  stop.onclick = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    audio.pause();
    audio.currentTime = 0;
    setPlayLabel(false);
    return false;
  };

  audio.onended = function () {
    setPlayLabel(false);
  };
})();

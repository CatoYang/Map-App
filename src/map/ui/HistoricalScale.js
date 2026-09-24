import L from 'leaflet';

export const HistoricalScale = L.Control.extend({
  options: {
    position: 'bottomleft',
    maxWidth: 150,
  },

  onAdd: function (map) {
    this._map = map;
    const container = L.DomUtil.create('div', 'historical-scale');

    this._mScale = this._createScale(container, 'metric');
    this._iScale = this._createScale(container, 'imperial');
    this._cScale = this._createScale(container, 'chinese');
    this._jScale = this._createScale(container, 'japanese');

    map.on('move', this._update, this);
    map.on('moveend', this._update, this);
    this._update();
    return container;
  },

  onRemove: function (map) {
    map.off('move', this._update, this);
    map.off('moveend', this._update, this);
  },

  _createScale: function (container, className) {
    return L.DomUtil.create('div', 'historical-scale__bar historical-scale__bar--' + className, container);
  },

  _getRoundNum: function (num) {
    const pow10 = Math.pow(10, (Math.floor(num) + '').length - 1);
    let d = num / pow10;
    d = d >= 10 ? 10 : d >= 8 ? 8 : d >= 6 ? 6 : d >= 5 ? 5 : d >= 4 ? 4 : d >= 3 ? 3 : d >= 2 ? 2 : 1;
    return pow10 * d;
  },

  _update: function () {
    const map = this._map;
    const y = map.getSize().y / 2;
    const p1 = map.containerPointToLatLng([0, y]);
    const p2 = map.containerPointToLatLng([this.options.maxWidth, y]);
    const maxMeters = p1.distanceTo(p2);

    if (maxMeters <= 0) return;

    this._updateMetric(maxMeters);
    this._updateImperial(maxMeters);
    this._updateChinese(maxMeters);
    this._updateJapanese(maxMeters);
  },

  _updateScaleBar: function (el, text, ratio) {
    const width = (this.options.maxWidth * ratio).toFixed(2);
    el.style.width = width + 'px';
    el.innerHTML = '<span>' + text + '</span>';
  },

  _updateMetric: function (maxMeters) {
    if (maxMeters > 1000) {
      const max = maxMeters / 1000;
      const round = this._getRoundNum(max);
      this._updateScaleBar(this._mScale, round + ' km', round / max);
    } else {
      const round = this._getRoundNum(maxMeters);
      this._updateScaleBar(this._mScale, round + ' m', round / maxMeters);
    }
  },

  _updateImperial: function (maxMeters) {
    const maxFeet = maxMeters / 0.3048;
    if (maxFeet > 5280) {
      const max = maxFeet / 5280;
      const round = this._getRoundNum(max);
      this._updateScaleBar(this._iScale, round + ' mi', round / max);
    } else {
      const round = this._getRoundNum(maxFeet);
      this._updateScaleBar(this._iScale, round + ' ft', round / maxFeet);
    }
  },

  _updateChinese: function (maxMeters) {
    if (maxMeters > 500) {
      const max = maxMeters / 500;
      const round = this._getRoundNum(max);
      this._updateScaleBar(this._cScale, round + ' Li (里)', round / max);
    } else {
      const max = maxMeters * 3;
      const round = this._getRoundNum(max);
      this._updateScaleBar(this._cScale, round + ' Chi (尺)', round / max);
    }
  },

  _updateJapanese: function (maxMeters) {
    if (maxMeters > 3927.27) {
      const max = maxMeters / 3927.27;
      const round = this._getRoundNum(max);
      this._updateScaleBar(this._jScale, round + ' Ri (里)', round / max);
    } else {
      const max = maxMeters / 109.09;
      const round = this._getRoundNum(max);
      this._updateScaleBar(this._jScale, round + ' Chō (町)', round / max);
    }
  }
});

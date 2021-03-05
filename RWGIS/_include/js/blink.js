var blink_speed = 1250; // every 1000 == 1 second, adjust to suit
var t = setInterval(function () {
    var ele = document.getElementById('emergecy');
    ele.style.visibility = (ele.style.visibility == 'hidden' ? '' : 'hidden');
}, blink_speed);
window.onload=function(){


 $(document).ready(function(){
    $("#map-intro__toggle").click(function() {
      if ($("#map-intros").is(":visible")) {
        $("#map-intros").toggle("0.2s");
        $(this).css({ position: 'relative', right: 0 });
      } else {
        $("#map-intros").toggle("0.2s");
        $(this).css({ position: 'absolute', right: -24 });
      }
    });
  });


$(document).ready(function(){
  $("#map-intro-start").click(function() {
    if ($("#map-intros").is(":visible")) {
      $("#map-intros").toggle("0.2s");
      $("#map-intro__toggle").css({ position: 'relative', right: 0 });
    } else {
      $("#map-intros").toggle("0.2s");
      $("#map-intro__toggle").css({ position: 'absolute', right: -24 });
    }
  });
});
};


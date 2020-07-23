exports.get = function(player, req, resp, onHandled) {
    requestWorld(req, resp, function(){
        onHandled();
    });
}

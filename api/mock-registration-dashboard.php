<?php
header('Content-Type: application/json');

$clients = [
    ["id"=>"C001","name"=>"John Doe","dob"=>"11/01/1978","medical"=>1,"dental"=>1,"optical"=>0,"hair"=>1],
    ["id"=>"C002","name"=>"Jane D. Rhett","dob"=>"07/21/2001","medical"=>0,"dental"=>1,"optical"=>1,"hair"=>0]
];

// Randomly add a new client to test "add row" functionality
if (rand(0,1)) {
    $clients[] = ["id"=>"C003","name"=>"Random User ".rand(1,100),"dob"=>"01/01/2000","medical"=>0,"dental"=>0,"optical"=>1,"hair"=>1];
}

echo json_encode($clients);
exit;

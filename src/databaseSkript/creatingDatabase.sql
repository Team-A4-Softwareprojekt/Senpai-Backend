create type exercisetype as enum ('gap text','multiple choice','manipulation','limitation','exercise');

create table exercise(
exerciseID SERIAL primary key,
difficulty INT,
question VARCHAR(800),
tasktype exercisetype,
solution VARCHAR(800)
);

create table player(
playerID SERIAL primary key,
playerName VARCHAR(25),
passwort VARCHAR(50),
rank INT,
subscribed BOOL,
streakToday BOOL,
missedStreak DATE,
playableGames INT rename to lives
);

alter table player rename column passwort to playerpassword;

create table tutor(
tutorID SERIAL primary key,
qualification VARCHAR(200),
playerID_fk INT,
foreign key (playerID_fk) references player
);

create table bankaccount(
bankaccountID SERIAL primary key,
bankname VARCHAR(50),
iban VARCHAR(25),
playerID_fk INT,
foreign key (playerID_fk) references player
);

create table course(
courseID SERIAL primary key,
title VARCHAR(25),
price DECIMAL(10,2),
description VARCHAR(200),
tutorID_fk INT,
foreign key (tutorID_fk) references tutor
);

create table solution(
solutionID SERIAL primary key,
solutiontext VARCHAR(800),
AIreview BOOL,
/*player who submitted solution*/
playerID_fk INT,
foreign key (playerID_fk) references player,
exerciseID_fk INT,
foreign key (exerciseID_fk) references exercise,
/*tutor who reviewed solution*/
tutorID_fk INT,
foreign key (tutorID_fk) references tutor
);

alter table solution
add column tutorcomment VARCHAR(200);

create table history(
historyID SERIAl primary key,
totalScore VARCHAR(30),
winner1 INT,
foreign key (winner1) references player,
winner2 INT,
foreign key (winner2) references player
);

create table friends(
friendID SERIAL primary key,
followerID INT,
followingID INT,
foreign key (followerID) references player,
foreign key (followingID) references player
);

create table playersHistory(
playerID_fk INT,
historyID_fk INT,
primary key (playerID_fk, historyID_fk),
foreign key (playerID_fk) references player,
foreign key (historyID_fk) references history
);

create table playerCourse(
playerID_fk INT,
courseID_fk INT,
primary key (playerID_fk, courseID_fk),
foreign key (playerID_fk) references player,
foreign key (courseID_fk) references course
);


alter table player 
add column email VARCHAR(100);

/*adding default values for easier registration of new players*/
alter table player
alter column rank set default 0;

alter table player
alter column subscribed set default false;

alter table player
alter column streakToday set default false;

alter table player
alter column playableGames set default 3;

alter table player
rename column playableGames to lives;

/*increasing password length for encryption*/
alter table player
alter column playerpassword type VARCHAR(70);


/*adding security questions to player*/
create type securityquestion as enum ('Wie lautet der Mädchenname Ihrer Mutter?','In welcher Stadt wurden Sie geboren?','Wie hieß Ihr Klassenlehrer in der Grundschule?');

alter table player
add column playersecurityquestion securityquestion;

alter table player
add column securityquestionresponse VARCHAR(100);


/*adding more question types*/
create table multiplechoicequestion(
mcquestionid SERIAL primary key,
difficulty INT,
question VARCHAR(300),
aanswer VARCHAR(100),
banswer VARCHAR(100),
canswer VARCHAR(100),
danswer VARCHAR(100),
solution VARCHAR(5)
);

create table gaptextquestion(
gtquestionid SERIAL primary key,
difficulty INT,
questiontext VARCHAR(800),
missingwords VARCHAR(300),
completedtext VARCHAR(800)
);

alter table gaptextquestion 
drop column questiontext;

alter table gaptextquestion
rename column missingwords to missingwordposition;


create table manipulation(
manipulationID SERIAL primary key,
difficulty INT,
code VARCHAR(600),
outputtext VARCHAR(200),
permittedsymbols VARCHAR(200)
);

alter table gaptextquestion
add column shortbuzzerquestion BOOL;

alter table exercise
drop column tasktype;

alter table exercise
drop column solution;

/*adding columns to manage subscriptions*/
alter table player
add column credit INT;

alter table player
add column subenddate DATE;

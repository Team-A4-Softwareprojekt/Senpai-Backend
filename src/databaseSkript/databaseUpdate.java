import java.sql.*;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;

//---------------------------------------------------------------------------------------------------------------------------------------------//
//       NOTE: THIS SKRIPT NEEDS TO RUN ON A DIFFERENT DEVICE DUE TO THE FREE TRIAL RENDER-SERVER SHUTTING DOWN WHEN INACTIVE                  //
//       THE SKRIPT IS PLACED HERE FOR COMPLETENESS / INTEGRITY OF THE PRODUCT                                                                 //
//---------------------------------------------------------------------------------------------------------------------------------------------//

public class databaseUpdate {

    private Connection connection;

    //1440 minutes for 24 hours
    long timeInMinutes= 1440;
    int subscriptionPrice=3;

    public databaseUpdate(){
        String url="jdbc:postgresql://dpg-cotl9a7109ks73an4iug-a.frankfurt-postgres.render.com/lernplattformdb";
        String password="z46dQYVIYnVeGf19tLgyWCg4g2Uo0u4n";
        String username="lernplattformdb_user";
        System.out.println("DATABSE SKRIPT: Connection to database successful");
        try{
            this.connection = DriverManager.getConnection(url, username, password);
            System.out.println("Connection to database successful");
        }catch (SQLException exception){
            System.out.println(exception.getMessage());
        }

    }

    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);


    /**
     * counts down from timeInMinutes and calls sqlfunctions
     *
     */
    public void countdowntimer(){
        Runnable timer = new Runnable() {
            @Override
            public void run() {
                sqlfunctions();
            }
        };

        scheduler.schedule(timer, this.timeInMinutes, java.util.concurrent.TimeUnit.MINUTES);

    }

    /**
     * calls all sql-functions and restarts countdown
     */
    public void sqlfunctions(){
        this.checkSubscription();
        this.resetplayerlives();
        this.checkStreak();
        countdowntimer();
    }

    /**
     * checks if player's subscription is expired, reduces credit amount for the next month or cancels subscription
     */
    public void checkSubscription(){
        try{
            String selectSql = "SELECT playerid, subenddate, subscribed, credit FROM player";

            //extending subscription period
            String updateSql = "UPDATE player SET subenddate = ?, credit = (? - ?) WHERE playerid = ? and subscribed = ? and (? - ?) > ?";

            //ending subscription without sufficient credit
            String alternativeUpdate = "UPDATE player SET subscribed = ? WHERE playerid = ? and (? - ?) < ?";

            PreparedStatement statement = connection.prepareStatement(selectSql);
            PreparedStatement statement2 = connection.prepareStatement(updateSql);
            PreparedStatement statement3 = connection.prepareStatement(alternativeUpdate);

            LocalDate today = LocalDate.now();
            ResultSet rs = statement.executeQuery();

            while(rs.next()){
                int playerId = rs.getInt("playerid");
                Date endOfSubscriptionDate = rs.getDate("subenddate");
                boolean continuingSubscription = rs.getBoolean("subscribed");
                int credit = rs.getInt("credit");

                if(endOfSubscriptionDate!=null){

                if(endOfSubscriptionDate.toLocalDate().isEqual(today)) {
                    LocalDate updatedDate = endOfSubscriptionDate.toLocalDate().plus(30, ChronoUnit.DAYS);
                    Date updatedSqlDate = Date.valueOf(updatedDate);

                    statement2.setDate(1, updatedSqlDate);
                    statement2.setInt(2, credit);
                    statement2.setInt(3, this.subscriptionPrice);
                    statement2.setInt(4, playerId);
                    statement2.setBoolean(5, true);
                    statement2.setInt(6, credit);
                    statement2.setInt(7, this.subscriptionPrice);
                    statement2.setInt(8, 0);

                    statement2.executeUpdate();

                    statement3.setBoolean(1, false);
                    statement3.setInt(2, playerId);
                    statement3.setInt(3, credit);
                    statement3.setInt(4, this.subscriptionPrice);
                    statement3.setInt(5, 0);

                    statement3.executeUpdate();
                }
                }
            }
            System.out.println("updating subscription success");
        }catch (SQLException exception){
            System.out.println("updating subscription failed");
        }
    }

    /**
     *
     * checks if player completed streak task, resets variable in database
     */
    public void checkStreak(){
        try{
            String sqlCode = "UPDATE player SET missedstreak = ? where streaktoday = ?;";
            PreparedStatement statement = connection.prepareStatement(sqlCode);

            LocalDate yesterday = LocalDate.now().minusDays(1);
            Date sqlDate = Date.valueOf(yesterday);
            statement.setDate(1, sqlDate);
            statement.setBoolean(2, false);
            statement.executeUpdate();

            String updateSql = "UPDATE player SET streaktoday = ?";
            PreparedStatement statement2 = connection.prepareStatement(updateSql);
            statement2.setBoolean(1, false);
            statement2.executeUpdate();

            System.out.println("updating streak success");
        }catch (SQLException exception){
            System.out.println("updating streak failed");
        }
    }

    /**
     *
     * resets lives of all players to 3
     */
    public void resetplayerlives(){
        try{
            String sqlCode = "UPDATE player SET lives = ?;";
            PreparedStatement statement = connection.prepareStatement(sqlCode);
            statement.setInt(1, 3);

            statement.executeUpdate();
            System.out.println("updating lives success");
        }catch (SQLException exception){
            System.out.println("updating lives failed");
        }
    }

    public static void main(String[] args) {
        databaseUpdate dbu = new databaseUpdate();
        dbu.countdowntimer();
    }

}

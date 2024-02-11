const supabase = require("./db.js");
const router = require("express").Router();


async function processSellHistoryData(sellHistoryData) {
  const monthName = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "July",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  // now we have to fill the missing month in sorted order for the last 12 months,
  // check the system date, and fill the missing month and add 0 to the amount
  // append the year also. for example Feb-24, Jan-24, Dec-23, .... Mar-23 (if the current month is February 2024)

  // first sort the array
  sellHistoryData.sort((a, b) => {
    return a.month_no - b.month_no;
  });

  // now fill the missing month
  let currentMonth = new Date().getMonth() + 1;
  let currentYear = new Date().getFullYear();

  let monthYears = [];
  let last12Months = [];
  for (let i = 0; i < 12; i++) {
    last12Months.push(currentMonth);
    monthYears.push(currentYear);
    currentMonth--;
    if (currentMonth == 0) {
      currentMonth = 12;
      currentYear--;
    }
  }

  // now we have the last 12 months in sorted order
  // now we have to check if there is any missing month in the sellHistoryData
  // if there is any missing month, then we have to add that month with 0 amount

  //  now iterate through the sellHistoryData following the last12Months array, and add a field named amount as well as month name (Jan-24, Feb-24, Mar-24, ....)

  let last12MonthsIndex = 0;
  let last12MonthsLength = last12Months.length;

  // sellHistoryDataReturned is the array that will be returned, it will contain the last 12 months data

  let sellHistoryDataReturned = [];

  for (
    last12MonthsIndex = 0;
    last12MonthsIndex < last12MonthsLength;
    last12MonthsIndex++
  ) {
    let month_no = last12Months[last12MonthsIndex];

    // check if the month_no is present in the sellHistoryData, if present, find the index and add the amount and month name with year in the sellHistoryDataReturned array
    // if not present, add the month_no with 0 amount

    let found = false;
    for (
      let sellHistoryDataIndex = 0;
      sellHistoryDataIndex < sellHistoryData.length;
      sellHistoryDataIndex++
    ) {
      if (sellHistoryData[sellHistoryDataIndex].month_no == month_no) {
        // month_no is present in the sellHistoryData
        found = true;
        sellHistoryDataReturned.push({
          month:
            monthName[month_no - 1] +
            "-" +
            monthYears[last12MonthsIndex].toString().slice(2),
          amount:
            parseFloat(sellHistoryData[sellHistoryDataIndex].total) -
            parseFloat(sellHistoryData[sellHistoryDataIndex].totalcashback),
        });
        break;
      }
    }

    // if the month_no is not present in the sellHistoryData, add the month_no with 0 amount
    if (!found) {
      sellHistoryDataReturned.push({
        month:
          monthName[month_no - 1] +
          "-" +
          monthYears[last12MonthsIndex].toString().slice(2),
        amount: 0,
      });
    }
  }

  // reverse the sellHistoryDataReturned array
  sellHistoryDataReturned.reverse();

  return sellHistoryDataReturned;
}

router.post("/", async (req, res) => {
  console.log("Holla bro");
  console.log(req.body.id);
  let response = await supabase.any(
    `SELECT "name", "nid", "email", "phone", "avatarLink", "permanentAddress",  "dob",  (SELECT "name" AS "unionName" FROM "UnionParishad" where "UnionParishad"."id" = "unionId"), \
    (SELECT "name" AS "agentName" FROM "User" where "id" = (SELECT "agentId" FROM "Vendor" where "Vendor"."id" = $1)) \
    FROM "User" where "id" = $1;`,
    [req.body.id]
  );
  const basicData = response[0];

  console.log(basicData);
  let rankandpointArray = await supabase.any(
    `SELECT "rank", "points" FROM "Vendor" where "Vendor"."id" = $1;`,
    [req.body.id]
  );

  let rankandpoint = rankandpointArray[0];

  console.log(rankandpoint);

  // populate data table for next rank point point reaching
  let rankTable = await supabase.any(
    `SELECT "className", "max", "min", "cashback", "nextRank" FROM "Rank" where "Rank"."className" = $1`,
    [rankandpoint.rank]
  );

  rankandpoint.minPoint = rankTable[0].min;
  rankandpoint.maxPoint = rankTable[0].max;
  rankandpoint.nextRank = rankTable[0].nextRank;
  rankandpoint.cashback = rankTable[0].cashback;

  let buyHistoryData = await supabase.any(
    `SELECT EXTRACT('MONTH' FROM "timestamp") AS month_no, SUM("total") as total, SUM("cashback") as totalCashback \
    FROM "VendorSell" \
    where "vendorId" = $1 and "status" = 'approved' and "timestamp" > NOW() - INTERVAL '1 year' \
    GROUP BY EXTRACT('MONTH' FROM "timestamp");`,
    [req.body.id]
  );

  console.log(buyHistoryData);

  let buyHistoryOneYear = await processSellHistoryData(buyHistoryData);
  const responseObj = { basicData, rankandpoint, buyHistoryOneYear };

  console.log(responseObj);

  res.status(200).json(responseObj);
});

module.exports = router;
